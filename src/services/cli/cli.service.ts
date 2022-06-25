import { Inject, Injectable } from '@nestjs/common';
import prompt, { Schema } from 'prompt';

import { CliSettings, CLI_SETTINGS } from './cli-settings';

@Injectable()
export class CliService {
    constructor(
        @Inject(CLI_SETTINGS) private readonly cliSettings: CliSettings,
    ) {
        prompt.start({ message: 'Question' });
    }

    private get lineSep(): string {
        return this.cliSettings.lineSep;
    }

    async prompt(message: string): Promise<void> {
        console.log('');
        console.log(message);
    }

    async request(question: string): Promise<string> {
        let description =
            question +
            this.lineSep +
            'Enter nothing to abort operation.' +
            this.lineSep;
        const schema: Schema = {
            properties: {
                question: {
                    description,
                },
            },
        };
        console.log('');
        return new Promise<string>((resolve, reject) => {
            prompt.get(schema, (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    if (!result.question) {
                        resolve(undefined);
                    } else {
                        resolve(result.question as string);
                    }
                }
            });
        });
    }

    async choose(question: string, options?: string[]): Promise<string> {
        let description = question;
        if (!!options) {
            description += this.lineSep;
            description +=
                'Choose on option by typing its number.' +
                this.lineSep +
                'Enter nothing to abort operation.' +
                this.lineSep;
            for (let index = 0; index < options.length; index++) {
                const answer = options[index];
                description += '(' + (index + 1) + ') ' + answer + this.lineSep;
            }
        }
        const schema: Schema = {
            properties: {
                question: {
                    description,
                },
            },
        };

        console.log('');
        return new Promise<string>((resolve, reject) => {
            prompt.get(schema, (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    if (!result.question) {
                        resolve(undefined);
                    } else {
                        if (!options) {
                            resolve(result.question as string);
                        } else {
                            const answerIndex = +result.question;
                            if (
                                answerIndex < 0 ||
                                answerIndex > options.length
                            ) {
                                resolve(undefined);
                            } else {
                                resolve(options[answerIndex - 1]);
                            }
                        }
                    }
                }
            });
        });
    }
}
