import { Module } from '@nestjs/common';
import { CmsService } from './cms.service';
import { CmsController, AdminCmsController } from './cms.controller';

@Module({
  controllers: [CmsController, AdminCmsController],
  providers: [CmsService],
  exports: [CmsService],
})
export class CmsModule {}
