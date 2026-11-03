// Bridges Sparkle 2 to the main process for macOS in-place updates.
//
// Sparkle does the work (appcast, delta or full download, EdDSA check,
// extraction, install on quit or relaunch). This file replaces Sparkle's
// windows with a user driver that reports each step to JavaScript, so the
// app's own update dialog stays the only UI (src/main/download/macSparkleUpdater.ts).
//
// Built by scripts/sparkle.mjs with clang against Node's N-API headers
// (N-API is ABI-stable, so Electron loads it). Links
// @rpath/Sparkle.framework, found in Contents/Frameworks.
//
// Exports:
//   start(onEvent(type, json))  creates and starts the updater; throws on failure
//   check(feedUrl, version, userAgent)  checks that feed and downloads `version`
//   cancel()   cancels a running check or download; true if one was running
//   install()  installs a ready update now and relaunches; true if one was ready
//
// Sparkle calls the user driver on the main thread, which in Electron's main
// process is the JavaScript thread too. Events still go through a
// thread-safe function so each callback runs in a proper Node scope.
#import <AppKit/AppKit.h>
#import <Foundation/Foundation.h>
#import <Sparkle/Sparkle.h>

#define NAPI_VERSION 8
#include <node_api.h>

#include <string>

static napi_threadsafe_function gEmitter = nullptr;

struct BridgeEvent {
  std::string type;
  std::string json;
};

static void CallJs(napi_env env, napi_value callback, void *, void *data) {
  BridgeEvent *event = static_cast<BridgeEvent *>(data);
  if (env != nullptr && callback != nullptr) {
    napi_value args[2];
    napi_value undefined;
    napi_create_string_utf8(env, event->type.c_str(), NAPI_AUTO_LENGTH, &args[0]);
    napi_create_string_utf8(env, event->json.c_str(), NAPI_AUTO_LENGTH, &args[1]);
    napi_get_undefined(env, &undefined);
    napi_call_function(env, undefined, callback, 2, args, nullptr);
  }
  delete event;
}

static void Emit(NSString *type, NSDictionary *payload) {
  if (gEmitter == nullptr) return;
  NSData *data = [NSJSONSerialization dataWithJSONObject:(payload ?: @{}) options:0 error:nil];
  std::string json = data ? std::string(static_cast<const char *>(data.bytes), data.length) : "{}";
  BridgeEvent *event = new BridgeEvent{std::string(type.UTF8String), json};
  if (napi_call_threadsafe_function(gEmitter, event, napi_tsfn_nonblocking) != napi_ok) delete event;
}

static NSDictionary *ErrorPayload(NSError *error) {
  return @{
    @"domain" : error.domain ?: @"",
    @"code" : @(error.code),
    @"message" : error.localizedDescription ?: @"",
    @"reason" : error.localizedFailureReason ?: @"",
  };
}

#pragma mark - User driver

@interface ASUserDriver : NSObject <SPUUserDriver>
@property(nonatomic, copy) NSString *expectedVersion;
@property(nonatomic, copy) void (^cancellation)(void);
@property(nonatomic, copy) void (^installReply)(SPUUserUpdateChoice);
@property(nonatomic, copy) void (^retryTermination)(void);
@property(nonatomic) uint64_t expectedLength;
@property(nonatomic) uint64_t receivedLength;
@property(nonatomic) NSInteger lastPercent;
@end

@implementation ASUserDriver

- (void)reset {
  self.cancellation = nil;
  self.installReply = nil;
  self.retryTermination = nil;
  self.expectedLength = 0;
  self.receivedLength = 0;
  self.lastPercent = -1;
}

// Automatic checks are off (SUEnableAutomaticChecks NO), so this should not
// be asked; answer it without a window if it is.
- (void)showUpdatePermissionRequest:(SPUUpdatePermissionRequest *)request
                              reply:(void (^)(SUUpdatePermissionResponse *))reply {
  reply([[SUUpdatePermissionResponse alloc] initWithAutomaticUpdateChecks:NO sendSystemProfile:NO]);
}

- (void)showUserInitiatedUpdateCheckWithCancellation:(void (^)(void))cancellation {
  self.cancellation = cancellation;
  Emit(@"checking", nil);
}

- (void)showUpdateFoundWithAppcastItem:(SUAppcastItem *)item
                                 state:(SPUUserUpdateState *)state
                                 reply:(void (^)(SPUUserUpdateChoice))reply {
  self.cancellation = nil;
  if (item.informationOnlyUpdate) {
    reply(SPUUserUpdateChoiceDismiss);
    Emit(@"error", @{@"code" : @(-1), @"domain" : @"AutoSlides", @"message" : @"The release feed offers no download"});
    return;
  }
  // The app already chose the version from the GitHub release; refuse any
  // other the feed may name.
  if (self.expectedVersion.length > 0 && ![item.versionString isEqualToString:self.expectedVersion]) {
    reply(SPUUserUpdateChoiceDismiss);
    Emit(@"error", @{
      @"code" : @(-1),
      @"domain" : @"AutoSlides",
      @"message" : [NSString stringWithFormat:@"The release feed offers %@, not %@", item.versionString, self.expectedVersion],
    });
    return;
  }
  Emit(@"found", @{@"version" : item.versionString ?: @"", @"stage" : @(state.stage)});
  if (state.stage == SPUUserUpdateStageInstalling) {
    // Already extracted and waiting: an Install reply would quit right away.
    // Hold it until the user picks Restart to Update.
    self.installReply = reply;
    Emit(@"ready", nil);
    return;
  }
  reply(SPUUserUpdateChoiceInstall);
}

- (void)showUpdateReleaseNotesWithDownloadData:(SPUDownloadData *)downloadData {
}

- (void)showUpdateReleaseNotesFailedToDownloadWithError:(NSError *)error {
}

- (void)showUpdateNotFoundWithError:(NSError *)error acknowledgement:(void (^)(void))acknowledgement {
  self.cancellation = nil;
  Emit(@"error", ErrorPayload(error));
  acknowledgement();
}

- (void)showUpdaterError:(NSError *)error acknowledgement:(void (^)(void))acknowledgement {
  self.cancellation = nil;
  Emit(@"error", ErrorPayload(error));
  acknowledgement();
}

- (void)showDownloadInitiatedWithCancellation:(void (^)(void))cancellation {
  self.cancellation = cancellation;
  self.expectedLength = 0;
  self.receivedLength = 0;
  self.lastPercent = -1;
  Emit(@"downloading", nil);
}

- (void)showDownloadDidReceiveExpectedContentLength:(uint64_t)expectedContentLength {
  self.expectedLength = expectedContentLength;
  self.receivedLength = 0;
  self.lastPercent = -1;
  Emit(@"progress", @{@"received" : @0, @"expected" : @(expectedContentLength)});
}

- (void)showDownloadDidReceiveDataOfLength:(uint64_t)length {
  self.receivedLength += length;
  // One event per whole percent; per chunk would flood the IPC.
  NSInteger percent = self.expectedLength > 0
      ? (NSInteger)MIN((uint64_t)100, self.receivedLength * 100 / self.expectedLength)
      : (NSInteger)(self.receivedLength >> 20);
  if (percent == self.lastPercent) return;
  self.lastPercent = percent;
  Emit(@"progress", @{@"received" : @(self.receivedLength), @"expected" : @(self.expectedLength)});
}

- (void)showDownloadDidStartExtractingUpdate {
  self.cancellation = nil;
  Emit(@"extracting", nil);
}

- (void)showExtractionReceivedProgress:(double)progress {
}

- (void)showReadyToInstallAndRelaunch:(void (^)(SPUUserUpdateChoice))reply {
  // Left unanswered until Restart to Update. Meanwhile Sparkle's installer
  // waits and installs when the app quits.
  self.installReply = reply;
  Emit(@"ready", nil);
}

- (void)showInstallingUpdateWithApplicationTerminated:(BOOL)applicationTerminated
                          retryTerminatingApplication:(void (^)(void))retryTerminatingApplication {
  // A quit the app cancels (the close guard for running tasks) leaves the
  // update waiting; Restart to Update then asks to quit again.
  self.retryTermination = applicationTerminated ? (void (^)(void))nil : retryTerminatingApplication;
  Emit(@"installing", @{@"terminated" : @(applicationTerminated)});
}

- (void)showUpdateInstalledAndRelaunched:(BOOL)relaunched acknowledgement:(void (^)(void))acknowledgement {
  acknowledgement();
}

- (void)dismissUpdateInstallation {
  BOOL hadInstall = self.installReply != nil || self.retryTermination != nil;
  self.cancellation = nil;
  self.installReply = nil;
  self.retryTermination = nil;
  Emit(@"dismissed", @{@"hadInstall" : @(hadInstall)});
}

- (void)showUpdateInFocus {
}

@end

#pragma mark - Updater delegate

@interface ASUpdaterDelegate : NSObject <SPUUpdaterDelegate>
@property(nonatomic, copy) NSString *feedURL;
@end

@implementation ASUpdaterDelegate

// The feed is the offered release's own folder, on GitHub or through the
// proxy, chosen per check (no SUFeedURL in Info.plist).
- (NSString *)feedURLStringForUpdater:(SPUUpdater *)updater {
  return self.feedURL;
}

@end

#pragma mark - N-API

static SPUUpdater *gUpdater = nil;
static ASUserDriver *gDriver = nil;
static ASUpdaterDelegate *gDelegate = nil;

static napi_value JsUndefined(napi_env env) {
  napi_value value;
  napi_get_undefined(env, &value);
  return value;
}

static napi_value JsBool(napi_env env, bool flag) {
  napi_value value;
  napi_get_boolean(env, flag, &value);
  return value;
}

static NSString *StringArg(napi_env env, napi_value value) {
  size_t length = 0;
  if (napi_get_value_string_utf8(env, value, nullptr, 0, &length) != napi_ok) return nil;
  std::string buffer(length, '\0');
  napi_get_value_string_utf8(env, value, buffer.data(), length + 1, &length);
  return [NSString stringWithUTF8String:buffer.c_str()];
}

static napi_value Start(napi_env env, napi_callback_info info) {
  if (gUpdater != nil) return JsUndefined(env);
  size_t argc = 1;
  napi_value argv[1];
  napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
  napi_valuetype type = napi_undefined;
  if (argc < 1 || napi_typeof(env, argv[0], &type) != napi_ok || type != napi_function) {
    napi_throw_type_error(env, nullptr, "start(onEvent) needs a function");
    return nullptr;
  }
  napi_value name;
  napi_create_string_utf8(env, "SparkleBridge", NAPI_AUTO_LENGTH, &name);
  if (napi_create_threadsafe_function(env, argv[0], nullptr, name, 0, 1, nullptr, nullptr, nullptr, CallJs,
                                      &gEmitter) != napi_ok) {
    napi_throw_error(env, nullptr, "Could not create the event callback");
    return nullptr;
  }
  napi_unref_threadsafe_function(env, gEmitter);

  gDriver = [[ASUserDriver alloc] init];
  [gDriver reset];
  gDelegate = [[ASUpdaterDelegate alloc] init];
  NSBundle *bundle = [NSBundle mainBundle];
  SPUUpdater *updater = [[SPUUpdater alloc] initWithHostBundle:bundle
                                             applicationBundle:bundle
                                                    userDriver:gDriver
                                                      delegate:gDelegate];
  NSError *error = nil;
  if (![updater startUpdater:&error]) {
    NSString *message = error.localizedDescription ?: @"Sparkle did not start";
    napi_throw_error(env, nullptr, message.UTF8String);
    return nullptr;
  }
  // The app decides when to check; Sparkle never checks on its own.
  updater.automaticallyChecksForUpdates = NO;
  updater.automaticallyDownloadsUpdates = NO;
  gUpdater = updater;
  return JsUndefined(env);
}

static napi_value Check(napi_env env, napi_callback_info info) {
  if (gUpdater == nil) {
    napi_throw_error(env, nullptr, "Sparkle is not started");
    return nullptr;
  }
  size_t argc = 3;
  napi_value argv[3];
  napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
  NSString *feed = argc > 0 ? StringArg(env, argv[0]) : nil;
  NSString *version = argc > 1 ? StringArg(env, argv[1]) : nil;
  NSString *userAgent = argc > 2 ? StringArg(env, argv[2]) : nil;
  if (feed.length == 0 || version.length == 0) {
    napi_throw_type_error(env, nullptr, "check(feedUrl, version, userAgent) needs a feed and a version");
    return nullptr;
  }
  if (!gUpdater.canCheckForUpdates) {
    napi_throw_error(env, nullptr, "An update session is already running");
    return nullptr;
  }
  gDelegate.feedURL = feed;
  [gDriver reset];
  gDriver.expectedVersion = version;
  if (userAgent.length > 0) gUpdater.userAgentString = userAgent;
  [gUpdater checkForUpdates];
  return JsUndefined(env);
}

static napi_value Cancel(napi_env env, napi_callback_info) {
  void (^cancellation)(void) = gDriver.cancellation;
  if (cancellation == nil) return JsBool(env, false);
  gDriver.cancellation = nil;
  cancellation();
  return JsBool(env, true);
}

static napi_value Install(napi_env env, napi_callback_info) {
  void (^reply)(SPUUserUpdateChoice) = gDriver.installReply;
  if (reply != nil) {
    gDriver.installReply = nil;
    reply(SPUUserUpdateChoiceInstall);
    return JsBool(env, true);
  }
  void (^retry)(void) = gDriver.retryTermination;
  if (retry != nil) {
    retry();
    return JsBool(env, true);
  }
  return JsBool(env, false);
}

NAPI_MODULE_INIT() {
  napi_property_descriptor properties[] = {
      {"start", nullptr, Start, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"check", nullptr, Check, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"cancel", nullptr, Cancel, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"install", nullptr, Install, nullptr, nullptr, nullptr, napi_default, nullptr},
  };
  napi_define_properties(env, exports, sizeof(properties) / sizeof(properties[0]), properties);
  return exports;
}
