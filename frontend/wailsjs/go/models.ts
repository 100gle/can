export namespace accounts {
	
	export class Account {
	    id: string;
	    name: string;
	    tag: string;
	    provider: string;
	    providerLabel: string;
	    endpoint: string;
	    region: string;
	    extra: Record<string, string>;
	    useSSL: boolean;
	    port: number;
	    accessKeyPreview: string;
	    hasSecret: boolean;
	    createdAt: string;
	    updatedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new Account(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.tag = source["tag"];
	        this.provider = source["provider"];
	        this.providerLabel = source["providerLabel"];
	        this.endpoint = source["endpoint"];
	        this.region = source["region"];
	        this.extra = source["extra"];
	        this.useSSL = source["useSSL"];
	        this.port = source["port"];
	        this.accessKeyPreview = source["accessKeyPreview"];
	        this.hasSecret = source["hasSecret"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	    }
	}
	export class BatchImportError {
	    index: number;
	    name: string;
	    field: string;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new BatchImportError(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.index = source["index"];
	        this.name = source["name"];
	        this.field = source["field"];
	        this.message = source["message"];
	    }
	}
	export class BatchImportSummary {
	    total: number;
	    imported: number;
	    skipped: number;
	    failed: number;
	    errors: BatchImportError[];
	    cancelled: boolean;
	
	    static createFrom(source: any = {}) {
	        return new BatchImportSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.total = source["total"];
	        this.imported = source["imported"];
	        this.skipped = source["skipped"];
	        this.failed = source["failed"];
	        this.errors = this.convertValues(source["errors"], BatchImportError);
	        this.cancelled = source["cancelled"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class CreateAccountInput {
	    name: string;
	    tag: string;
	    provider: string;
	    endpoint: string;
	    accessKeyId: string;
	    secretAccessKey: string;
	    region: string;
	    extra: Record<string, string>;
	    useSSL: boolean;
	    port: number;
	
	    static createFrom(source: any = {}) {
	        return new CreateAccountInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.tag = source["tag"];
	        this.provider = source["provider"];
	        this.endpoint = source["endpoint"];
	        this.accessKeyId = source["accessKeyId"];
	        this.secretAccessKey = source["secretAccessKey"];
	        this.region = source["region"];
	        this.extra = source["extra"];
	        this.useSSL = source["useSSL"];
	        this.port = source["port"];
	    }
	}
	export class DialResult {
	    accountId: string;
	    provider: string;
	    status: string;
	    message: string;
	    buckets: string[];
	    checkedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new DialResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.accountId = source["accountId"];
	        this.provider = source["provider"];
	        this.status = source["status"];
	        this.message = source["message"];
	        this.buckets = source["buckets"];
	        this.checkedAt = source["checkedAt"];
	    }
	}
	export class ExportSummary {
	    filePath: string;
	    count: number;
	    cancelled: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ExportSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.filePath = source["filePath"];
	        this.count = source["count"];
	        this.cancelled = source["cancelled"];
	    }
	}
	export class ImportSummary {
	    filePath: string;
	    total: number;
	    imported: number;
	    skipped: number;
	    failed: number;
	    issues: string[];
	    cancelled: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ImportSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.filePath = source["filePath"];
	        this.total = source["total"];
	        this.imported = source["imported"];
	        this.skipped = source["skipped"];
	        this.failed = source["failed"];
	        this.issues = source["issues"];
	        this.cancelled = source["cancelled"];
	    }
	}
	export class UpdateAccountInput {
	    provider: string;
	    name: string;
	    tag: string;
	    endpoint: string;
	    accessKeyId: string;
	    secretAccessKey: string;
	    region: string;
	    extra: Record<string, string>;
	    useSSL: boolean;
	    port: number;
	
	    static createFrom(source: any = {}) {
	        return new UpdateAccountInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.provider = source["provider"];
	        this.name = source["name"];
	        this.tag = source["tag"];
	        this.endpoint = source["endpoint"];
	        this.accessKeyId = source["accessKeyId"];
	        this.secretAccessKey = source["secretAccessKey"];
	        this.region = source["region"];
	        this.extra = source["extra"];
	        this.useSSL = source["useSSL"];
	        this.port = source["port"];
	    }
	}

}

export namespace app {
	
	export class AccountCredentials {
	    accessKeyId: string;
	    secretAccessKey: string;
	
	    static createFrom(source: any = {}) {
	        return new AccountCredentials(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.accessKeyId = source["accessKeyId"];
	        this.secretAccessKey = source["secretAccessKey"];
	    }
	}
	export class DirectoryFilesResult {
	    basePath: string;
	    files: string[];
	
	    static createFrom(source: any = {}) {
	        return new DirectoryFilesResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.basePath = source["basePath"];
	        this.files = source["files"];
	    }
	}
	export class FileFilter {
	    displayName: string;
	    pattern: string;
	
	    static createFrom(source: any = {}) {
	        return new FileFilter(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.displayName = source["displayName"];
	        this.pattern = source["pattern"];
	    }
	}
	export class ListTransferTasksInput {
	    page: number;
	    pageSize: number;
	
	    static createFrom(source: any = {}) {
	        return new ListTransferTasksInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.page = source["page"];
	        this.pageSize = source["pageSize"];
	    }
	}
	export class ListTransferTasksResult {
	    tasks: transfer.TransferTask[];
	    total: number;
	    page: number;
	    pageSize: number;
	    totalPages: number;
	
	    static createFrom(source: any = {}) {
	        return new ListTransferTasksResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.tasks = this.convertValues(source["tasks"], transfer.TransferTask);
	        this.total = source["total"];
	        this.page = source["page"];
	        this.pageSize = source["pageSize"];
	        this.totalPages = source["totalPages"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class UploadFileError {
	    filePath: string;
	    error: string;
	
	    static createFrom(source: any = {}) {
	        return new UploadFileError(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.filePath = source["filePath"];
	        this.error = source["error"];
	    }
	}
	export class UploadFilesInput {
	    accountId: string;
	    bucket: string;
	    prefix: string;
	    filePaths: string[];
	    basePath: string;
	
	    static createFrom(source: any = {}) {
	        return new UploadFilesInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.accountId = source["accountId"];
	        this.bucket = source["bucket"];
	        this.prefix = source["prefix"];
	        this.filePaths = source["filePaths"];
	        this.basePath = source["basePath"];
	    }
	}
	export class UploadFilesResult {
	    tasks: transfer.TransferTask[];
	    failed: UploadFileError[];
	
	    static createFrom(source: any = {}) {
	        return new UploadFilesResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.tasks = this.convertValues(source["tasks"], transfer.TransferTask);
	        this.failed = this.convertValues(source["failed"], UploadFileError);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace config {
	
	export class BucketCORS {
	    rules: storage.CORSRule[];
	
	    static createFrom(source: any = {}) {
	        return new BucketCORS(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.rules = this.convertValues(source["rules"], storage.CORSRule);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class BucketEncryption {
	    enabled: boolean;
	    algorithm: string;
	    kmsKeyId: string;
	
	    static createFrom(source: any = {}) {
	        return new BucketEncryption(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.algorithm = source["algorithm"];
	        this.kmsKeyId = source["kmsKeyId"];
	    }
	}
	export class PolicyStatement {
	    sid: string;
	    effect: string;
	    principal: any;
	    action: any;
	    resource: any;
	    condition: Record<string, any>;
	
	    static createFrom(source: any = {}) {
	        return new PolicyStatement(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sid = source["sid"];
	        this.effect = source["effect"];
	        this.principal = source["principal"];
	        this.action = source["action"];
	        this.resource = source["resource"];
	        this.condition = source["condition"];
	    }
	}
	export class BucketPolicy {
	    version: string;
	    statement: PolicyStatement[];
	    raw: string;
	
	    static createFrom(source: any = {}) {
	        return new BucketPolicy(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.version = source["version"];
	        this.statement = this.convertValues(source["statement"], PolicyStatement);
	        this.raw = source["raw"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class BucketWebsite {
	    enabled: boolean;
	    indexKey: string;
	    errorKey: string;
	
	    static createFrom(source: any = {}) {
	        return new BucketWebsite(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.indexKey = source["indexKey"];
	        this.errorKey = source["errorKey"];
	    }
	}
	export class LifecycleRule {
	    id: string;
	    prefix: string;
	    status: string;
	    expirationDays: number;
	    transitionDays: number;
	    noncurrentDays: number;
	
	    static createFrom(source: any = {}) {
	        return new LifecycleRule(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.prefix = source["prefix"];
	        this.status = source["status"];
	        this.expirationDays = source["expirationDays"];
	        this.transitionDays = source["transitionDays"];
	        this.noncurrentDays = source["noncurrentDays"];
	    }
	}

}

export namespace logger {
	
	export class LogEntry {
	    level: string;
	    module: string;
	    message: string;
	    context: Record<string, any>;
	    timestamp: number;
	
	    static createFrom(source: any = {}) {
	        return new LogEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.level = source["level"];
	        this.module = source["module"];
	        this.message = source["message"];
	        this.context = source["context"];
	        this.timestamp = source["timestamp"];
	    }
	}

}

export namespace objects {
	
	export class AccessLink {
	    id: string;
	    method: string;
	    url: string;
	    expiresAt: string;
	    markdown: string;
	    html: string;
	    qrCode: string;
	    responseHeaders: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new AccessLink(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.method = source["method"];
	        this.url = source["url"];
	        this.expiresAt = source["expiresAt"];
	        this.markdown = source["markdown"];
	        this.html = source["html"];
	        this.qrCode = source["qrCode"];
	        this.responseHeaders = source["responseHeaders"];
	    }
	}
	export class AccessLinkRequest {
	    bucket: string;
	    key: string;
	    methods: string[];
	    expirationSeconds: number;
	    responseHeaders: Record<string, string>;
	    fileName: string;
	    versionId: string;
	
	    static createFrom(source: any = {}) {
	        return new AccessLinkRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.bucket = source["bucket"];
	        this.key = source["key"];
	        this.methods = source["methods"];
	        this.expirationSeconds = source["expirationSeconds"];
	        this.responseHeaders = source["responseHeaders"];
	        this.fileName = source["fileName"];
	        this.versionId = source["versionId"];
	    }
	}
	export class BatchOperationFailure {
	    bucket: string;
	    key: string;
	    error: string;
	
	    static createFrom(source: any = {}) {
	        return new BatchOperationFailure(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.bucket = source["bucket"];
	        this.key = source["key"];
	        this.error = source["error"];
	    }
	}
	export class BatchAttributesResult {
	    total: number;
	    succeeded: number;
	    failed: BatchOperationFailure[];
	
	    static createFrom(source: any = {}) {
	        return new BatchAttributesResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.total = source["total"];
	        this.succeeded = source["succeeded"];
	        this.failed = this.convertValues(source["failed"], BatchOperationFailure);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class BatchDeleteResult {
	    total: number;
	    succeeded: number;
	    failed: BatchOperationFailure[];
	
	    static createFrom(source: any = {}) {
	        return new BatchDeleteResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.total = source["total"];
	        this.succeeded = source["succeeded"];
	        this.failed = this.convertValues(source["failed"], BatchOperationFailure);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class DownloadBatchEntry {
	    bucket: string;
	    key: string;
	    relativePath: string;
	    size: number;
	    versionId: string;
	    isDir: boolean;
	
	    static createFrom(source: any = {}) {
	        return new DownloadBatchEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.bucket = source["bucket"];
	        this.key = source["key"];
	        this.relativePath = source["relativePath"];
	        this.size = source["size"];
	        this.versionId = source["versionId"];
	        this.isDir = source["isDir"];
	    }
	}
	export class DownloadBatchInput {
	    bucket: string;
	    entries: DownloadBatchEntry[];
	    targetDirectory: string;
	    archiveName: string;
	    conflictStrategy: string;
	
	    static createFrom(source: any = {}) {
	        return new DownloadBatchInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.bucket = source["bucket"];
	        this.entries = this.convertValues(source["entries"], DownloadBatchEntry);
	        this.targetDirectory = source["targetDirectory"];
	        this.archiveName = source["archiveName"];
	        this.conflictStrategy = source["conflictStrategy"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class DownloadObjectInput {
	    bucket: string;
	    key: string;
	    savePath: string;
	    targetDirectory: string;
	    conflictStrategy: string;
	    disableResume: boolean;
	    versionId: string;
	    expectedEtag: string;
	
	    static createFrom(source: any = {}) {
	        return new DownloadObjectInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.bucket = source["bucket"];
	        this.key = source["key"];
	        this.savePath = source["savePath"];
	        this.targetDirectory = source["targetDirectory"];
	        this.conflictStrategy = source["conflictStrategy"];
	        this.disableResume = source["disableResume"];
	        this.versionId = source["versionId"];
	        this.expectedEtag = source["expectedEtag"];
	    }
	}
	export class MoveObjectRequest {
	    sourceBucket: string;
	    sourceKey: string;
	    targetBucket: string;
	    targetKey: string;
	
	    static createFrom(source: any = {}) {
	        return new MoveObjectRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sourceBucket = source["sourceBucket"];
	        this.sourceKey = source["sourceKey"];
	        this.targetBucket = source["targetBucket"];
	        this.targetKey = source["targetKey"];
	    }
	}
	export class MoveObjectsResult {
	    total: number;
	    succeeded: number;
	    failed: BatchOperationFailure[];
	
	    static createFrom(source: any = {}) {
	        return new MoveObjectsResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.total = source["total"];
	        this.succeeded = source["succeeded"];
	        this.failed = this.convertValues(source["failed"], BatchOperationFailure);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class MutationOptions {
	    requestId: string;
	    origin: string;
	
	    static createFrom(source: any = {}) {
	        return new MutationOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.requestId = source["requestId"];
	        this.origin = source["origin"];
	    }
	}
	export class ObjectAttributes {
	    object: storage.ObjectDescriptor;
	    metadata?: Record<string, string>;
	    tags?: Record<string, string>;
	    acl?: storage.ObjectACL;
	
	    static createFrom(source: any = {}) {
	        return new ObjectAttributes(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.object = this.convertValues(source["object"], storage.ObjectDescriptor);
	        this.metadata = source["metadata"];
	        this.tags = source["tags"];
	        this.acl = this.convertValues(source["acl"], storage.ObjectACL);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ObjectAttributesPatch {
	    bucket: string;
	    key: string;
	    metadata: Record<string, string>;
	    tags: Record<string, string>;
	    contentType: string;
	    storageClass: string;
	    acl: string;
	
	    static createFrom(source: any = {}) {
	        return new ObjectAttributesPatch(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.bucket = source["bucket"];
	        this.key = source["key"];
	        this.metadata = source["metadata"];
	        this.tags = source["tags"];
	        this.contentType = source["contentType"];
	        this.storageClass = source["storageClass"];
	        this.acl = source["acl"];
	    }
	}
	export class UpdateObjectLegalHoldInput {
	    bucket: string;
	    key: string;
	    versionId: string;
	    status: string;
	
	    static createFrom(source: any = {}) {
	        return new UpdateObjectLegalHoldInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.bucket = source["bucket"];
	        this.key = source["key"];
	        this.versionId = source["versionId"];
	        this.status = source["status"];
	    }
	}
	export class UpdateObjectRetentionInput {
	    bucket: string;
	    key: string;
	    versionId: string;
	    mode: string;
	    retainUntil: string;
	    bypassGovernance: boolean;
	
	    static createFrom(source: any = {}) {
	        return new UpdateObjectRetentionInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.bucket = source["bucket"];
	        this.key = source["key"];
	        this.versionId = source["versionId"];
	        this.mode = source["mode"];
	        this.retainUntil = source["retainUntil"];
	        this.bypassGovernance = source["bypassGovernance"];
	    }
	}

}

export namespace options {
	
	export class SecondInstanceData {
	    Args: string[];
	    WorkingDirectory: string;
	
	    static createFrom(source: any = {}) {
	        return new SecondInstanceData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Args = source["Args"];
	        this.WorkingDirectory = source["WorkingDirectory"];
	    }
	}

}

export namespace storage {
	
	export class AccessGrant {
	    granteeType: string;
	    grantee: string;
	    permission: string;
	    displayName?: string;
	    uri?: string;
	
	    static createFrom(source: any = {}) {
	        return new AccessGrant(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.granteeType = source["granteeType"];
	        this.grantee = source["grantee"];
	        this.permission = source["permission"];
	        this.displayName = source["displayName"];
	        this.uri = source["uri"];
	    }
	}
	export class BucketACL {
	    ownerId: string;
	    ownerDisplayName: string;
	    canned: string;
	    grants: AccessGrant[];
	
	    static createFrom(source: any = {}) {
	        return new BucketACL(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ownerId = source["ownerId"];
	        this.ownerDisplayName = source["ownerDisplayName"];
	        this.canned = source["canned"];
	        this.grants = this.convertValues(source["grants"], AccessGrant);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class BucketCreateInput {
	    name: string;
	    region: string;
	    acl: string;
	    storageClass: string;
	    cosMultiAz: boolean;
	
	    static createFrom(source: any = {}) {
	        return new BucketCreateInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.region = source["region"];
	        this.acl = source["acl"];
	        this.storageClass = source["storageClass"];
	        this.cosMultiAz = source["cosMultiAz"];
	    }
	}
	export class BucketDescriptor {
	    name: string;
	    createdAt: string;
	    region: string;
	    objectCount: number;
	    size: number;
	
	    static createFrom(source: any = {}) {
	        return new BucketDescriptor(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.createdAt = source["createdAt"];
	        this.region = source["region"];
	        this.objectCount = source["objectCount"];
	        this.size = source["size"];
	    }
	}
	export class BucketReferer {
	    enabled: boolean;
	    allowEmpty: boolean;
	    whitelist: string[];
	    mode: string;
	
	    static createFrom(source: any = {}) {
	        return new BucketReferer(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.allowEmpty = source["allowEmpty"];
	        this.whitelist = source["whitelist"];
	        this.mode = source["mode"];
	    }
	}
	export class BucketVersioningConfiguration {
	    Status: string;
	    MFADelete: string;
	
	    static createFrom(source: any = {}) {
	        return new BucketVersioningConfiguration(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Status = source["Status"];
	        this.MFADelete = source["MFADelete"];
	    }
	}
	export class CORSRule {
	    ID: string;
	    AllowedHeaders: string[];
	    AllowedMethods: string[];
	    AllowedOrigins: string[];
	    ExposeHeaders: string[];
	    MaxAgeSeconds: number;
	
	    static createFrom(source: any = {}) {
	        return new CORSRule(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ID = source["ID"];
	        this.AllowedHeaders = source["AllowedHeaders"];
	        this.AllowedMethods = source["AllowedMethods"];
	        this.AllowedOrigins = source["AllowedOrigins"];
	        this.ExposeHeaders = source["ExposeHeaders"];
	        this.MaxAgeSeconds = source["MaxAgeSeconds"];
	    }
	}
	export class ListObjectsInput {
	    bucket: string;
	    region: string;
	    prefix: string;
	    delimiter: string;
	    limit: number;
	    marker: string;
	
	    static createFrom(source: any = {}) {
	        return new ListObjectsInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.bucket = source["bucket"];
	        this.region = source["region"];
	        this.prefix = source["prefix"];
	        this.delimiter = source["delimiter"];
	        this.limit = source["limit"];
	        this.marker = source["marker"];
	    }
	}
	export class ObjectDescriptor {
	    key: string;
	    size: number;
	    lastModified: string;
	    etag: string;
	    contentType: string;
	    storageClass: string;
	    isDir: boolean;
	    metadata: Record<string, string>;
	    versionId: string;
	    isSymlink: boolean;
	    symlinkTarget: string;
	
	    static createFrom(source: any = {}) {
	        return new ObjectDescriptor(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.size = source["size"];
	        this.lastModified = source["lastModified"];
	        this.etag = source["etag"];
	        this.contentType = source["contentType"];
	        this.storageClass = source["storageClass"];
	        this.isDir = source["isDir"];
	        this.metadata = source["metadata"];
	        this.versionId = source["versionId"];
	        this.isSymlink = source["isSymlink"];
	        this.symlinkTarget = source["symlinkTarget"];
	    }
	}
	export class ListObjectsResult {
	    objects: ObjectDescriptor[];
	    nextMarker: string;
	    truncated: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ListObjectsResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.objects = this.convertValues(source["objects"], ObjectDescriptor);
	        this.nextMarker = source["nextMarker"];
	        this.truncated = source["truncated"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class MAZConfiguration {
	    status: string;
	
	    static createFrom(source: any = {}) {
	        return new MAZConfiguration(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.status = source["status"];
	    }
	}
	export class ObjectACL {
	    canned: string;
	    ownerId: string;
	    ownerDisplayName: string;
	    grants: AccessGrant[];
	
	    static createFrom(source: any = {}) {
	        return new ObjectACL(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.canned = source["canned"];
	        this.ownerId = source["ownerId"];
	        this.ownerDisplayName = source["ownerDisplayName"];
	        this.grants = this.convertValues(source["grants"], AccessGrant);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class ObjectLegalHoldState {
	    status: string;
	
	    static createFrom(source: any = {}) {
	        return new ObjectLegalHoldState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.status = source["status"];
	    }
	}
	export class ObjectLockConfiguration {
	    enabled: boolean;
	    mode: string;
	    retentionDays: number;
	    retentionYears: number;
	
	    static createFrom(source: any = {}) {
	        return new ObjectLockConfiguration(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.mode = source["mode"];
	        this.retentionDays = source["retentionDays"];
	        this.retentionYears = source["retentionYears"];
	    }
	}
	export class ObjectRetentionState {
	    mode: string;
	    retainUntil: string;
	
	    static createFrom(source: any = {}) {
	        return new ObjectRetentionState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.mode = source["mode"];
	        this.retainUntil = source["retainUntil"];
	    }
	}
	export class PublicAccessBlock {
	    blockPublicAcls: boolean;
	    ignorePublicAcls: boolean;
	    blockPublicPolicy: boolean;
	    restrictPublicBuckets: boolean;
	
	    static createFrom(source: any = {}) {
	        return new PublicAccessBlock(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.blockPublicAcls = source["blockPublicAcls"];
	        this.ignorePublicAcls = source["ignorePublicAcls"];
	        this.blockPublicPolicy = source["blockPublicPolicy"];
	        this.restrictPublicBuckets = source["restrictPublicBuckets"];
	    }
	}

}

export namespace system {
	
	export class PingResult {
	    url: string;
	    method: string;
	    online: boolean;
	    statusCode: number;
	    checkedAt: string;
	    latencyMs: number;
	    resolvedIp: string;
	    reason: string;
	    error: string;
	
	    static createFrom(source: any = {}) {
	        return new PingResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.url = source["url"];
	        this.method = source["method"];
	        this.online = source["online"];
	        this.statusCode = source["statusCode"];
	        this.checkedAt = source["checkedAt"];
	        this.latencyMs = source["latencyMs"];
	        this.resolvedIp = source["resolvedIp"];
	        this.reason = source["reason"];
	        this.error = source["error"];
	    }
	}
	export class UpdateInfo {
	    currentVersion: string;
	    latestVersion: string;
	    updateAvailable: boolean;
	    releaseURL: string;
	    releaseNotes: string;
	    publishedAt: string;
	    isPrerelease: boolean;
	
	    static createFrom(source: any = {}) {
	        return new UpdateInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.currentVersion = source["currentVersion"];
	        this.latestVersion = source["latestVersion"];
	        this.updateAvailable = source["updateAvailable"];
	        this.releaseURL = source["releaseURL"];
	        this.releaseNotes = source["releaseNotes"];
	        this.publishedAt = source["publishedAt"];
	        this.isPrerelease = source["isPrerelease"];
	    }
	}

}

export namespace transfer {
	
	export class DownloadEntry {
	    bucket: string;
	    key: string;
	    relativePath: string;
	    size: number;
	    versionId: string;
	    isDir: boolean;
	
	    static createFrom(source: any = {}) {
	        return new DownloadEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.bucket = source["bucket"];
	        this.key = source["key"];
	        this.relativePath = source["relativePath"];
	        this.size = source["size"];
	        this.versionId = source["versionId"];
	        this.isDir = source["isDir"];
	    }
	}
	export class DownloadConfig {
	    mode: string;
	    targetDirectory: string;
	    archiveName: string;
	    conflictStrategy: string;
	    entries: DownloadEntry[];
	    resumeEnabled: boolean;
	    checksumAlgorithm?: string;
	    expectedChecksum?: string;
	
	    static createFrom(source: any = {}) {
	        return new DownloadConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.mode = source["mode"];
	        this.targetDirectory = source["targetDirectory"];
	        this.archiveName = source["archiveName"];
	        this.conflictStrategy = source["conflictStrategy"];
	        this.entries = this.convertValues(source["entries"], DownloadEntry);
	        this.resumeEnabled = source["resumeEnabled"];
	        this.checksumAlgorithm = source["checksumAlgorithm"];
	        this.expectedChecksum = source["expectedChecksum"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class TransferConfig {
	    workerCount: number;
	    speedLimit: number;
	
	    static createFrom(source: any = {}) {
	        return new TransferConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.workerCount = source["workerCount"];
	        this.speedLimit = source["speedLimit"];
	    }
	}
	export class TransferTask {
	    id: string;
	    type: string;
	    priority: number;
	    accountId: string;
	    bucket: string;
	    key: string;
	    localPath?: string;
	    status: string;
	    pauseReason?: string;
	    progress: number;
	    total: number;
	    speed: number;
	    estimatedTime: number;
	    startTime: string;
	    endTime: string;
	    error?: string;
	    retries: number;
	    maxRetries: number;
	    uploadId?: string;
	    completedParts?: Record<number, string>;
	    versionId?: string;
	    etag?: string;
	    downloadConfig?: DownloadConfig;
	    createdAt: string;
	    updatedAt: string;
	    computedChecksum?: string;
	    checksumVerified?: boolean;
	    finalSavePath?: string;
	    averageSpeed?: number;
	    duration?: number;
	
	    static createFrom(source: any = {}) {
	        return new TransferTask(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.type = source["type"];
	        this.priority = source["priority"];
	        this.accountId = source["accountId"];
	        this.bucket = source["bucket"];
	        this.key = source["key"];
	        this.localPath = source["localPath"];
	        this.status = source["status"];
	        this.pauseReason = source["pauseReason"];
	        this.progress = source["progress"];
	        this.total = source["total"];
	        this.speed = source["speed"];
	        this.estimatedTime = source["estimatedTime"];
	        this.startTime = source["startTime"];
	        this.endTime = source["endTime"];
	        this.error = source["error"];
	        this.retries = source["retries"];
	        this.maxRetries = source["maxRetries"];
	        this.uploadId = source["uploadId"];
	        this.completedParts = source["completedParts"];
	        this.versionId = source["versionId"];
	        this.etag = source["etag"];
	        this.downloadConfig = this.convertValues(source["downloadConfig"], DownloadConfig);
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	        this.computedChecksum = source["computedChecksum"];
	        this.checksumVerified = source["checksumVerified"];
	        this.finalSavePath = source["finalSavePath"];
	        this.averageSpeed = source["averageSpeed"];
	        this.duration = source["duration"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace types {
	
	export class ProviderFeature {
	    provider: string;
	    featureId: string;
	    name: string;
	    description: string;
	    supported: boolean;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new ProviderFeature(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.provider = source["provider"];
	        this.featureId = source["featureId"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.supported = source["supported"];
	        this.message = source["message"];
	    }
	}
	export class ProviderMetadata {
	    id: string;
	    label: string;
	    description: string;
	
	    static createFrom(source: any = {}) {
	        return new ProviderMetadata(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.label = source["label"];
	        this.description = source["description"];
	    }
	}

}

