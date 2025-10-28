import {FileSystem, WriteStream} from '../../src/lib/utils/FileUtil.js';
import {SpyWriteStream} from './SpyWriteStream.js';

export class StubFileSystem implements FileSystem {
    existsReturnValue: boolean = false;
    exists(_filename: string): Promise<boolean> {
        return Promise.resolve(this.existsReturnValue);
    }

    writeFileSyncCallHistory: {file: string, contents: string}[] = [];
    writeFileSync(file: string, contents: string): void {
        this.writeFileSyncCallHistory.push({file, contents});
    }

    createWriteStreamReturnValue: WriteStream = new SpyWriteStream();
    createWriteStream(_file: string): Promise<WriteStream> {
        return Promise.resolve(this.createWriteStreamReturnValue);
    }
}