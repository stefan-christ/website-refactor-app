class QuitException extends Error {
    constructor() {
        super('quit');
    }
}

export const Quit = new QuitException();
