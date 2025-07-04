import { translateDiskSpace } from './dav';
import { DAVResult, DiskQuota } from '../types';

export function parseQuota(result: DAVResult): DiskQuota | null {
	try {
		const [responseItem] = result.multistatus.response;
		const {
			propstat: {
				// @ts-ignore
				prop: { 'quota-used-bytes': quotaUsed, 'quota-available-bytes': quotaAvail },
			},
		} = responseItem;
		return typeof quotaUsed !== 'undefined' && typeof quotaAvail !== 'undefined'
			? {
					// As it could be both a string or a number ensure we are working with a number
					used: parseInt(String(quotaUsed), 10),
					available: translateDiskSpace(quotaAvail),
				}
			: null;
	} catch (err) {
		/* ignore */
	}
	return null;
}
