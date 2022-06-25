import { Module } from '@nestjs/common';
import { CliModule } from '../cli/cli.module';
import { ConfigurationModule } from '../configuration/configuration.module';
import { IoModule } from '../io/io.module';
import { RefactorService } from './refactorer.service';

@Module({
    imports: [ConfigurationModule, IoModule, CliModule],
    providers: [RefactorService],
    exports: [RefactorService],
})
export class RefactorerModule {}
