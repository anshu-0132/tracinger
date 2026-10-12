/**
 * Replay Lab Service
 *
 * Manages predefined fault scenarios and their execution.
 * Fault injection targets ONLY the explicitly configured demo services.
 * This capability is disabled by default and requires ENABLE_FAULT_INJECTION=true.
 */
import type { ReplayScenario } from '@tracinger/shared';
declare class ReplayService {
    getScenarios(): ReplayScenario[];
    getScenario(id: string): ReplayScenario | undefined;
    startRun(scenarioId: string): Promise<{
        id: string;
        status: string;
    }>;
    private executeScenario;
}
export declare const replayService: ReplayService;
export {};
//# sourceMappingURL=replay.d.ts.map