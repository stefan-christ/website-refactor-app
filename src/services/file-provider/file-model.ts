export interface File {
    name: string;
    parentPath: string;
    extension: string;
}

export interface Link {
    name: string;
    parentPath: string;
}

export interface Directory {
    name: string;
    parentPath: string;

    directories?: Directory[];
    files?: File[];
    links?: Link[];
}

export interface Tree extends Directory {
    type: 'local' | 'remote';
}
