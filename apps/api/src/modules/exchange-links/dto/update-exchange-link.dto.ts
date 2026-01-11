import { PartialType } from '@nestjs/swagger';
import { CreateExchangeLinkDto } from './create-exchange-link.dto';

export class UpdateExchangeLinkDto extends PartialType(CreateExchangeLinkDto) {}
