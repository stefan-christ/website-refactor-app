import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { AnalyzerModule } from './services/analyzer/analyzer.module';
import { CliModule } from './services/cli/cli.module';
import { FileProviderModule } from './services/file-provider/file-provider.module';
import { RefactorModule } from './services/refactor/refactor.module';

@Module({
    imports: [CliModule, AnalyzerModule, RefactorModule, FileProviderModule],
    providers: [AppService],
})
export class AppModule {}
