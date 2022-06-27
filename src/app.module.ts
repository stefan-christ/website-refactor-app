import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { AnalyzerModule } from './services/analyzer/analyzer.module';
import { CliModule } from './services/cli/cli.module';
import { ConfigurationModule } from './services/configuration/configuration.module';
import { FtpModule } from './services/ftp/ftp.module';
import { IoModule } from './services/io/io.module';
import { RefactorerModule } from './services/refactorer/refactorer.module';

@Module({
    imports: [
        IoModule,
        CliModule,
        FtpModule,
        ConfigurationModule,
        AnalyzerModule,
        RefactorerModule,
    ],
    providers: [AppService],
})
export class AppModule {}
