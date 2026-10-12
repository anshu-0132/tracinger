import { Request, Response, NextFunction } from 'express';
export declare class AppError extends Error {
    readonly statusCode: number;
    readonly code: string;
    readonly details?: unknown | undefined;
    constructor(statusCode: number, code: string, message: string, details?: unknown | undefined);
}
export declare function notFound(req: Request, res: Response): void;
export declare function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void;
//# sourceMappingURL=errorHandler.d.ts.map