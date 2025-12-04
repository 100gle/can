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
	    // Go type: time
	    createdAt: any;
	    // Go type: time
	    updatedAt: any;
	
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
	        this.createdAt = this.convertValues(source["createdAt"], null);
	        this.updatedAt = this.convertValues(source["updatedAt"], null);
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
	export class ConnectionTestResult {
	    accountId: string;
	    provider: string;
	    status: string;
	    message: string;
	    // Go type: time
	    checkedAt: any;
	
	    static createFrom(source: any = {}) {
	        return new ConnectionTestResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.accountId = source["accountId"];
	        this.provider = source["provider"];
	        this.status = source["status"];
	        this.message = source["message"];
	        this.checkedAt = this.convertValues(source["checkedAt"], null);
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
	    // Go type: time
	    createdAt: any;
	    region: string;
	    objectCount: number;
	    size: number;
	
	    static createFrom(source: any = {}) {
	        return new BucketInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	        this.region = source["region"];
	        this.objectCount = source["objectCount"];
	        this.size = source["size"];
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
	    // Go type: time
	    lastModified: any;
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
	        this.lastModified = this.convertValues(source["lastModified"], null);
	        this.etag = source["etag"];
	        this.contentType = source["contentType"];
	        this.isDir = source["isDir"];
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

export namespace types {
	
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

