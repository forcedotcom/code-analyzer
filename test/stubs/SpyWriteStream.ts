import { WriteStream } from "../../src/lib/utils/FileUtil";

export class SpyWriteStream implements WriteStream {
    writeCallHistory: {content: string}[] = [];
    write(content: string): void {
        this.writeCallHistory.push({content});
    }

    endCallCount: number = 0;
    end(): void {
        this.endCallCount++;
    }
}