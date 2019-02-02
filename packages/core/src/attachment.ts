import { bytesToBase64, base64ToBytes } from "./encoding";
import { SimpleContainer } from "./container";
import { Vault } from "./vault";
import { getProvider, AESKeyParams } from "./crypto";
import { Err, ErrorCode } from "./error";
import { RequestProgress } from "./transport";

function readFile(blob: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            const result = bytesToBase64(new Uint8Array(reader.result as ArrayBuffer));
            resolve(result);
        };

        reader.onerror = e => {
            reader.abort();
            reject(e);
        };

        reader.readAsArrayBuffer(blob);
    });
}

function readFileAsDataURL(blob: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            resolve(reader.result as string);
        };

        reader.onerror = e => {
            reader.abort();
            reject(e);
        };

        reader.readAsDataURL(blob);
    });
}

export interface AttachmentInfo {
    id: string;
    vault: string;
    name: string;
    size: number;
    type: string;
    key: string;
}

export class Attachment extends SimpleContainer {
    id: string = "";
    vault: string = "";
    name: string = "";
    size: number = 0;
    type: string = "";
    uploadProgress?: RequestProgress;
    downloadProgress?: RequestProgress;

    constructor(info?: Partial<AttachmentInfo>) {
        super();
        if (info) {
            this.id = info.id || "";
            this.vault = info.vault || "";
            this.name = info.name || "";
            this.size = info.size || 0;
            this.type = info.type || "";
            this.key = info.key || "";
        }
    }

    get info(): AttachmentInfo {
        return {
            id: this.id,
            vault: this.vault,
            name: this.name,
            type: this.type,
            size: this.size,
            key: this.key
        };
    }

    get loaded(): boolean {
        return !!this.encryptedData;
    }

    async fromFile(file: File) {
        this.type = file.type;
        this.size = file.size;
        this.name = file.name;

        const data = await readFile(file);

        this.key = await getProvider().generateKey({
            algorithm: "AES",
            keySize: this.encryptionParams.keySize
        } as AESKeyParams);

        await this.set(data);
    }

    async toFile(): Promise<File> {
        const data = await this.get();
        return new File([base64ToBytes(data)], this.name, { type: this.type });
    }

    async toDataURL(): Promise<string> {
        const file = await this.toFile();
        return readFileAsDataURL(file);
    }

    async toObjectURL(): Promise<string> {
        const file = await this.toFile();
        return URL.createObjectURL(file);
    }

    async serialize() {
        return {
            ...(await super.serialize()),
            size: this.size,
            id: this.id,
            vault: this.vault
        };
    }

    async deserialize(raw: any) {
        this.id = raw.id;
        this.vault = raw.vault;
        this.size = raw.size;
        return super.deserialize(raw);
    }
}

export interface AttachmentStorage {
    put(a: Attachment): Promise<void>;
    get(a: Attachment): Promise<Attachment>;
    delete(a: Attachment): Promise<void>;
    deleteAll(vault: Vault): Promise<void>;
    getUsage(vault: Vault): Promise<number>;
}

export class MemoryAttachmentStorage {
    private _storage = new Map<string, Attachment>();

    async put(a: Attachment): Promise<void> {
        this._storage.set(`${a.vault}_${a.id}`, a);
    }

    async get(a: Attachment): Promise<Attachment> {
        const att = this._storage.get(`${a.vault}_${a.id}`);
        if (!att) {
            throw new Err(ErrorCode.NOT_FOUND);
        }
        return att;
    }

    async delete(a: Attachment): Promise<void> {
        this._storage.delete(`${a.vault}_${a.id}`);
    }

    async deleteAll(vault: Vault): Promise<void> {
        for (const key of this._storage.keys()) {
            if (key.startsWith(vault.id)) {
                this._storage.delete(key);
            }
        }
    }

    async getUsage(vault: Vault): Promise<number> {
        let size = 0;
        for (const [key, att] of this._storage.entries()) {
            if (key.startsWith(vault.id)) {
                size += att.size;
            }
        }
        return size;
    }
}