const PERF_VERBOSE_KEY = 'scPerfVerbose'

export function isPerfVerbose(): boolean {
	try {
		return localStorage.getItem(PERF_VERBOSE_KEY) === '1'
	} catch {
		return false
	}
}

export function shouldLogPerf(elapsedMs: number, thresholdMs: number): boolean {
	return elapsedMs >= thresholdMs || isPerfVerbose()
}
