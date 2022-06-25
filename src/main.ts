import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppService } from './app.service';
import { Quit } from './services/quit-exception';

console.log('application start');

const bootstrap = async (): Promise<void> => {
    const app = await NestFactory.createApplicationContext(AppModule, {
        bufferLogs: true,
    });

    try {
        const appService = app.get(AppService);
        await appService.startup();
    } catch (error) {
        if (error !== Quit && error.message !== 'canceled') {
            throw error;
        }
    }
};

bootstrap()
    .then(() => console.log('\n\napplication quit\n'))
    .catch((error) => console.error('\n\napplication error\n', error));
