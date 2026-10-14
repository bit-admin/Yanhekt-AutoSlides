// Reading a course or session argument. Pure, so it is unit-tested.
//
// A bare number means what the command expects — a course id to `course`, a
// session id to `session` and `download` — because the two cannot be told
// apart by looking. A link says which it is, so the wrong kind of link gets a
// pointer to the command that takes it.
import { parseSessionInput } from '@common/sessionInput';
import { CliError } from './errors';

const NOT_A_LINK = (raw: string, kind: 'session' | 'course'): string =>
  `not a ${kind} id or Yanhekt ${kind} link (such as https://www.yanhekt.cn/${kind}/<id>): ${raw}`;

export function parseSessionTarget(raw: string, program: string): string {
  const parsed = parseSessionInput(raw);
  if (parsed.kind === 'session') return parsed.sessionId;
  if (parsed.kind === 'course') {
    throw new CliError(
      'usage',
      `this is a course link, not a session link: ${raw}`,
      `Run '${program} course ${parsed.courseId}' to list its sessions, or '${program} download --course ${parsed.courseId}' for all of them.`
    );
  }
  throw new CliError('usage', NOT_A_LINK(raw, 'session'));
}

export function parseCourseTarget(raw: string, program: string): string {
  const text = raw.trim();
  if (/^\d+$/.test(text)) return String(Number(text));
  const parsed = parseSessionInput(text);
  if (parsed.kind === 'course') return parsed.courseId;
  if (parsed.kind === 'session') {
    throw new CliError(
      'usage',
      `this is a session link, not a course link: ${raw}`,
      `Run '${program} session ${parsed.sessionId}' to see that session and its course.`
    );
  }
  throw new CliError('usage', NOT_A_LINK(raw, 'course'));
}
