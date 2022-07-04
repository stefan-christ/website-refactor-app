import { Module } from '@nestjs/common';
import { CliModule } from '../cli/cli.module';
import { ConfigurationModule } from '../configuration/configuration.module';
import { FileProviderModule } from '../file-provider/file-provider.module';
import { IoModule } from '../io/io.module';
import { RefactorService } from './refactor.service';

@Module({
    imports: [ConfigurationModule, FileProviderModule, IoModule, CliModule],
    providers: [RefactorService],
    exports: [RefactorService],
})
export class RefactorModule {}
