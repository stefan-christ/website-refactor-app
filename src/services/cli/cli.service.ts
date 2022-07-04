import { Injectable } from '@nestjs/common';
import prompt, { Schema } from 'prompt';

export interface Option {
    answer: string;
    choice: string;
}

export const OPTION_QUIT: Option = { answer: 'Quit', choice: 'Q' };

@Injectable()
export class CliService {
    constructor() {
        prompt.start();
    }

    getOptionGoBack(origin: string): Option {
        return { answer: 'Go back to ' + origin, choice: 'B' };
    }

    private get lineSep(): string {
        return '\n';
    }

    async prompt(message: unknown): Promise<void> {
        console.log('');
        console.log(message);
    }

    async request(question: string): Promise<string> {
        prompt.message = question;
        let description =
            this.lineSep + 'Enter nothing to abort operation.' + this.lineSep;
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

    async secret(question: string): Promise<string> {
        prompt.message = question;

        let description =
            this.lineSep + 'Enter nothing to abort operation.' + this.lineSep;
        const schema = {
            properties: {
                question: {
                    description,
                    hidden: true,
                    replace: '*',
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

    async choose(
        menu: string,
        question: string,
        options?: Option[],
    ): Promise<string> {
        prompt.message = menu;

        let description = !!question ? this.lineSep + question : '';

        if (!!options) {
            description += this.lineSep;
            description +=
                'Choose on option by typing its number or letter.' +
                this.lineSep +
                'Enter nothing to abort operation.' +
                this.lineSep;
            description += this.lineSep;
            for (let index = 0; index < options.length; index++) {
                if (!options[index]) {
                    description += this.lineSep;
                } else {
                    const answer = options[index].answer;
                    const choice = options[index].choice;
                    description += '(' + choice + ') ' + answer + this.lineSep;
                }
            }
            description += this.lineSep;
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
                            const index = options.findIndex(
                                (option) =>
                                    option?.choice.toLowerCase() ===
                                    result.question.toString().toLowerCase(),
                            );
                            if (index === -1) {
                                resolve(undefined);
                            } else {
                                resolve(options[index].answer);
                            }
                        }
                    }
                }
            });
        });
    }
}
