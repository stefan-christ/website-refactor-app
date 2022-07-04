import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppService } from './app.service';
import { Quit } from './quit-exception';

console.log('************************');
console.log('* WEBSITE REFACTOR APP *');
console.log('************************');

const bootstrap = async (): Promise<INestApplicationContext> => {
    const app = await NestFactory.createApplicationContext(AppModule, {
        bufferLogs: true,
    });
    app.enableShutdownHooks();

    try {
        const appService = app.get(AppService);
        await appService.startup();
    } catch (error) {
        if (error !== Quit && error.message !== 'canceled') {
            throw error;
        }
    }
    return app;
};

bootstrap()
    .then(async (app: INestApplicationContext) => {
        console.log('\n\nBye-bye...\n');
        await app.close();
    })
    .catch((error) => {
        console.error('\n\nOops, an error!\n', error);
        process.exit(0);
    });
