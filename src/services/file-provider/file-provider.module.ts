import { Module } from '@nestjs/common';
import { FtpModule } from '../ftp/ftp.module';
import { IoModule } from '../io/io.module';

import { FileProviderService } from './file-provider.service';

@Module({
    imports: [FtpModule, IoModule],
    providers: [FileProviderService],
    exports: [FileProviderService],
})
export class FileProviderModule {}
