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
	export class UpdateAccountInput {
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

