interface UploadResult {
    success: boolean;
    url?: string;
    path?: string;
    error?: string;
}
declare class R2MediaStorageService {
    private isConfigured;
    uploadFile(folder: string, fileBuffer: Buffer, fileName: string, contentType: string): Promise<UploadResult>;
    deleteFile(key: string): Promise<boolean>;
    getUrl(key: string): string;
}
export declare const r2MediaStorage: R2MediaStorageService;
export {};
//# sourceMappingURL=r2-media-storage.service.d.ts.map