import { describe, expect, it } from 'vitest'
import { describeShareFailures } from './driveUploadStart'
import type { DriveUploadRow } from './driveUploadQueue'

const t = (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key)
const row = (patch: Partial<DriveUploadRow>): DriveUploadRow => ({
  folderPath: '/out/slides_A__c1s2', jobId: 'j', status: 'done', total: 4, done: 4, failed: 0, skipped: 0, ...patch,
})

describe('describeShareFailures', () => {
  it('says nothing when every folder went through or was stopped on request', () => {
    expect(describeShareFailures(t, [row({}), row({ status: 'cancelled', done: 1 })])).toBeNull()
  })

  it('names each folder with slides left behind, then how to retry', () => {
    const summary = describeShareFailures(t, [
      row({ failed: 2, done: 2 }),
      row({ folderPath: 'C:\\out\\slides_B__c1s3', status: 'error', error: 'busy' }),
      row({ folderPath: '/out/slides_C__c1s4' }),
    ])
    expect(summary?.message).toBe('drive.shareFailedMessage {"count":2}')
    expect(summary?.detail.split('\n')).toEqual([
      'drive.shareFailedFolder {"name":"slides_A__c1s2","failed":2,"total":4}',
      'drive.shareFailedFolderError {"name":"slides_B__c1s3"}',
      '',
      'drive.shareFailedRetry',
    ])
  })

  it('puts a sign-out first: nothing else can be shared until then', () => {
    expect(describeShareFailures(t, [row({ failed: 1 }), row({ status: 'cancelled', error: 'sign-in' })]))
      .toEqual({ message: 'drive.shareStoppedSignIn', detail: 'drive.shareFailedRetry' })
  })
})
