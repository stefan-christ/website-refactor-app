const NO_FINDINGS = -1000;
const INITAL_POSITION = -1;

export type ProblemCallback = (
    fileName: string,
    token: string,
    problem: string,
    snippet: string,
) => void;

export class Replacer {
    private fileName: string = '';
    private data: string = '';
    private dataLength: number = 0;
    private dataChanges: number = 0;

    private token: string = '';
    private tokenLength: number = 0;
    private tokenOffset: number = NO_FINDINGS;

    private _problemCallback?: ProblemCallback;

    set problemCallback(cb: ProblemCallback) {
        this._problemCallback = cb;
    }

    constructor(
        private readonly filenameCharacters: string,
        private readonly validLeadSequences: string[],
        private readonly validTrailSequences: string[],
    ) {}

    init(fileName: string, data: string): void {
        if (data === undefined || data === null) {
            throw new Error('illegal data: ' + data);
        }
        this.fileName = fileName;
        this.data = data;
        this.dataLength = data.length;
        this.dataChanges = 0;
        this.setToken('');
    }

    setToken(token: string): void {
        this.token = token;
        this.tokenLength = token.length;
        this.tokenOffset =
            this.dataLength === 0 || this.tokenLength === 0
                ? NO_FINDINGS
                : INITAL_POSITION;
    }

    changes(): number {
        return this.dataChanges;
    }

    hasMore(): boolean {
        if (this.tokenOffset === NO_FINDINGS) {
            return false;
        }

        let index = this.tokenOffset;

        do {
            index = this.data.indexOf(this.token, index + 1);
            if (index === -1) {
                this.tokenOffset = NO_FINDINGS;
                return false;
            }

            // check leading sequence
            if (index > 0) {
                const previousCharacter = this.data
                    .substring(index - 1, index)
                    .toLowerCase();

                if (this.filenameCharacters.includes(previousCharacter)) {
                    continue;
                } else if (this.isPreceededByLeadingSequence(index)) {
                    //ok
                } else {
                    this.reportProblem(
                        index,
                        `previous character '${previousCharacter}'`,
                    );
                    continue;
                }
            }

            // check if no trail exists
            if (index + this.tokenLength === this.dataLength) {
                this.tokenOffset = index;
                return true;
            }

            // check trailing sequence
            const nextCharacter = this.data
                .substring(
                    index + this.tokenLength,
                    index + this.tokenLength + 1,
                )
                .toLowerCase();

            if (this.filenameCharacters.includes(nextCharacter)) {
                continue;
            } else if (this.isFollowedByTrailingSequence(index)) {
                //ok
            } else {
                this.reportProblem(index, `next character '${nextCharacter}'`);
                continue;
            }

            this.tokenOffset = index;
            return true;
        } while (true);
    }

    replaceWith(replacement: string) {
        this.dataChanges++;
        this.data =
            this.data.substring(0, this.tokenOffset) +
            replacement +
            this.data.substring(this.tokenOffset + this.tokenLength);
        this.dataLength = this.data.length;
        this.tokenOffset += replacement.length;
    }

    getData(): string {
        return this.data;
    }

    private isFollowedByTrailingSequence(index: number): boolean {
        for (const sequence of this.validTrailSequences) {
            const sequenceLen = sequence.length;
            if (index < sequenceLen) {
                continue;
            }
            if (
                this.data.substring(
                    index + this.tokenLength,
                    index + this.tokenLength + sequenceLen,
                ) === sequence
            ) {
                return true;
            }
        }
        return false;
    }

    private isPreceededByLeadingSequence(index: number): boolean {
        for (const sequence of this.validLeadSequences) {
            const sequenceLen = sequence.length;
            if (index < sequenceLen) {
                continue;
            }
            if (this.data.substring(index - sequenceLen, index) === sequence) {
                return true;
            }
        }
        return false;
    }

    private reportProblem(index: number, problem: string) {
        if (this._problemCallback) {
            const padding = 20;
            const start = index - padding;
            const end = index + this.tokenLength + padding;
            this._problemCallback(
                this.fileName,
                this.token,
                problem,
                this.data.substring(start, end),
            );
        }
    }
}
