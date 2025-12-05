export namespace accounts {
	
	export class Account {
	    id: string;
	    name: string;
	    provider: string;
	    providerLabel: string;
	    endpoint: string;
	    region: string;
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
	        this.provider = source["provider"];
	        this.providerLabel = source["providerLabel"];
	        this.endpoint = source["endpoint"];
	        this.region = source["region"];
	        this.useSSL = source["useSSL"];
	        this.port = source["port"];
	        this.accessKeyPreview = source["accessKeyPreview"];
	        this.hasSecret = source["hasSecret"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	    }
	}
	export class ConnectionTestResult {
	    accountId: string;
	    provider: string;
	    status: string;
	    message: string;
	    checkedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new ConnectionTestResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.accountId = source["accountId"];
	        this.provider = source["provider"];
	        this.status = source["status"];
	        this.message = source["message"];
	        this.checkedAt = source["checkedAt"];
	    }
	}
	export class CreateAccountInput {
	    name: string;
	    provider: string;
	    endpoint: string;
	    accessKeyId: string;
	    secretAccessKey: string;
	    region: string;
	    useSSL: boolean;
	    port: number;
	
	    static createFrom(source: any = {}) {
	        return new CreateAccountInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.provider = source["provider"];
	        this.endpoint = source["endpoint"];
	        this.accessKeyId = source["accessKeyId"];
	        this.secretAccessKey = source["secretAccessKey"];
	        this.region = source["region"];
	        this.useSSL = source["useSSL"];
	        this.port = source["port"];
	    }
	}
	export class ExportSummary {
	    filePath: string;
	    count: number;
	    cipher: string;
	    version: string;
	    cancelled: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ExportSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.filePath = source["filePath"];
	        this.count = source["count"];
	        this.cipher = source["cipher"];
	        this.version = source["version"];
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
	    provider?: string;
	    name?: string;
	    endpoint?: string;
	    accessKeyId?: string;
	    secretAccessKey?: string;
	    region?: string;
	    useSSL?: boolean;
	    port?: number;
	
	    static createFrom(source: any = {}) {
	        return new UpdateAccountInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.provider = source["provider"];
	        this.name = source["name"];
	        this.endpoint = source["endpoint"];
	        this.accessKeyId = source["accessKeyId"];
	        this.secretAccessKey = source["secretAccessKey"];
	        this.region = source["region"];
	        this.useSSL = source["useSSL"];
	        this.port = source["port"];
	    }
	}

}

export namespace buckets {
	
	export class BucketInfo {
	    name: string;
	    createdAt: string;
	    region: string;
	    objectCount: number;
	    size: number;
	
	    static createFrom(source: any = {}) {
	        return new BucketInfo(source);
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

}

export namespace config {
	
	export class CORSRule {
	    allowedOrigins: string[];
	    allowedMethods: string[];
	    allowedHeaders: string[];
	    exposeHeaders: string[];
	    maxAgeSeconds: number;
	
	    static createFrom(source: any = {}) {
	        return new CORSRule(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.allowedOrigins = source["allowedOrigins"];
	        this.allowedMethods = source["allowedMethods"];
	        this.allowedHeaders = source["allowedHeaders"];
	        this.exposeHeaders = source["exposeHeaders"];
	        this.maxAgeSeconds = source["maxAgeSeconds"];
	    }
	}
	export class BucketCORS {
	    rules: CORSRule[];
	
	    static createFrom(source: any = {}) {
	        return new BucketCORS(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.rules = this.convertValues(source["rules"], CORSRule);
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
	    updated: string;
	
	    static createFrom(source: any = {}) {
	        return new BucketEncryption(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.algorithm = source["algorithm"];
	        this.kmsKeyId = source["kmsKeyId"];
	        this.updated = source["updated"];
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
	export class BucketVersioning {
	    status: string;
	    updated: string;
	
	    static createFrom(source: any = {}) {
	        return new BucketVersioning(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.status = source["status"];
	        this.updated = source["updated"];
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

export namespace objects {
	
	export class ListObjectsInput {
	    bucket: string;
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
	        this.prefix = source["prefix"];
	        this.delimiter = source["delimiter"];
	        this.limit = source["limit"];
	        this.marker = source["marker"];
	    }
	}
	export class ObjectInfo {
	    key: string;
	    size: number;
	    lastModified: string;
	    etag: string;
	    contentType: string;
	    isDir: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ObjectInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.size = source["size"];
	        this.lastModified = source["lastModified"];
	        this.etag = source["etag"];
	        this.contentType = source["contentType"];
	        this.isDir = source["isDir"];
	    }
	}
	export class ListObjectsResult {
	    objects: ObjectInfo[];
	    nextMarker: string;
	    truncated: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ListObjectsResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.objects = this.convertValues(source["objects"], ObjectInfo);
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

}

export namespace search {
	
	export class SearchQuery {
	    accountId: string;
	    bucket: string;
	    prefix: string;
	    searchText: string;
	    sortBy: string;
	    sortOrder: string;
	    minSize: number;
	    maxSize: number;
	    startTime?: string;
	    endTime?: string;
	    fileTypes: string[];
	    tags: Record<string, string>;
	    limit: number;
	    offset: number;
	
	    static createFrom(source: any = {}) {
	        return new SearchQuery(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.accountId = source["accountId"];
	        this.bucket = source["bucket"];
	        this.prefix = source["prefix"];
	        this.searchText = source["searchText"];
	        this.sortBy = source["sortBy"];
	        this.sortOrder = source["sortOrder"];
	        this.minSize = source["minSize"];
	        this.maxSize = source["maxSize"];
	        this.startTime = source["startTime"];
	        this.endTime = source["endTime"];
	        this.fileTypes = source["fileTypes"];
	        this.tags = source["tags"];
	        this.limit = source["limit"];
	        this.offset = source["offset"];
	    }
	}
	export class SearchResult {
	    key: string;
	    bucket: string;
	    size: number;
	    lastModified: string;
	    etag: string;
	    contentType: string;
	    storageClass: string;
	    tags: Record<string, string>;
	    score: number;
	
	    static createFrom(source: any = {}) {
	        return new SearchResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.bucket = source["bucket"];
	        this.size = source["size"];
	        this.lastModified = source["lastModified"];
	        this.etag = source["etag"];
	        this.contentType = source["contentType"];
	        this.storageClass = source["storageClass"];
	        this.tags = source["tags"];
	        this.score = source["score"];
	    }
	}
	export class SearchResponse {
	    results: SearchResult[];
	    total: number;
	    hasMore: boolean;
	    nextOffset: number;
	
	    static createFrom(source: any = {}) {
	        return new SearchResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.results = this.convertValues(source["results"], SearchResult);
	        this.total = source["total"];
	        this.hasMore = source["hasMore"];
	        this.nextOffset = source["nextOffset"];
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

export namespace transfer {
	
	export class TransferTask {
	    id: string;
	    type: string;
	    accountId: string;
	    bucket: string;
	    key: string;
	    localPath?: string;
	    status: string;
	    progress: number;
	    total: number;
	    speed: number;
	    estimatedTime: number;
	    startTime: string;
	    endTime?: string;
	    error?: string;
	    retries: number;
	    maxRetries: number;
	    uploadId?: string;
	    completedParts?: Record<number, string>;
	    createdAt: string;
	    updatedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new TransferTask(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.type = source["type"];
	        this.accountId = source["accountId"];
	        this.bucket = source["bucket"];
	        this.key = source["key"];
	        this.localPath = source["localPath"];
	        this.status = source["status"];
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
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	    }
	}

}

export namespace types {
	
	export class ProviderCapability {
	    provider: string;
	    featureId: string;
	    name: string;
	    description: string;
	    supported: boolean;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new ProviderCapability(source);
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
