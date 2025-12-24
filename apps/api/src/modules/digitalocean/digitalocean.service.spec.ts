import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DigitalOceanService } from './digitalocean.service';
import { CreateDropletDto } from './dto/droplet.dto';

/**
 * DigitalOcean Service 单元测试
 * 测试沙盒模式的创建/销毁/查询功能
 */
describe('DigitalOceanService (Sandbox Mode)', () => {
  let service: DigitalOceanService;

  beforeEach(async () => {
    // Mock ConfigService - 强制启用沙盒模式
    const mockConfigService = {
      get: jest.fn((key: string) => {
        const config: Record<string, string> = {
          DO_API_TOKEN: 'fake-token-for-testing',
          DO_SANDBOX_MODE: 'true',
          DO_DEFAULT_REGION: 'sgp1',
          DO_DEFAULT_SIZE: 's-1vcpu-1gb',
          DO_DEFAULT_IMAGE: 'docker-20-04',
        };
        return config[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DigitalOceanService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<DigitalOceanService>(DigitalOceanService);
  });

  it('应该正确初始化服务', () => {
    expect(service).toBeDefined();
  });

  describe('createDroplet', () => {
    it('应该在沙盒模式下创建模拟 Droplet', async () => {
      const dto: CreateDropletDto = {
        name: 'test-droplet-1',
        tags: ['quantfi', 'test'],
      };

      const result = await service.createDroplet(dto);

      expect(result).toBeDefined();
      expect(result.id).toMatch(/^sandbox-/);
      expect(result.name).toBe(dto.name);
      expect(result.status).toBe('active');
      expect(result.ip).toMatch(/^192\.168\.\d+\.\d+$/);
      expect(result.tags).toContain('quantfi');
    });

    it('应该使用默认配置创建 Droplet', async () => {
      const dto: CreateDropletDto = {
        name: 'test-droplet-2',
      };

      const result = await service.createDroplet(dto);

      expect(result.region).toBe('sgp1');
      expect(result.size).toBe('s-1vcpu-1gb');
      expect(result.image).toBe('docker-20-04');
    });
  });

  describe('getDroplet', () => {
    it('应该查询到已创建的 Droplet', async () => {
      const dto: CreateDropletDto = {
        name: 'test-droplet-3',
      };

      const created = await service.createDroplet(dto);
      const fetched = await service.getDroplet(created.id);

      expect(fetched).toEqual(created);
    });

    it('应该在查询不存在的 Droplet 时抛出异常', async () => {
      await expect(service.getDroplet('non-existent-id')).rejects.toThrow(
        'Droplet 不存在',
      );
    });
  });

  describe('listDroplets', () => {
    it('应该列出所有 Droplet', async () => {
      await service.createDroplet({ name: 'test-1' });
      await service.createDroplet({ name: 'test-2' });

      const result = await service.listDroplets();

      expect(result.droplets.length).toBeGreaterThanOrEqual(2);
      expect(result.total).toBe(result.droplets.length);
    });

    it('应该按标签过滤 Droplet', async () => {
      await service.createDroplet({
        name: 'test-with-tag',
        tags: ['special'],
      });
      await service.createDroplet({ name: 'test-without-tag' });

      const result = await service.listDroplets('special');

      expect(result.droplets.length).toBeGreaterThanOrEqual(1);
      expect(result.droplets[0].tags).toContain('special');
    });
  });

  describe('destroyDroplet', () => {
    it('应该成功销毁 Droplet', async () => {
      const dto: CreateDropletDto = {
        name: 'test-destroy',
      };

      const created = await service.createDroplet(dto);

      await expect(service.destroyDroplet(created.id)).resolves.not.toThrow();

      // 销毁后应该查询不到
      await expect(service.getDroplet(created.id)).rejects.toThrow();
    });

    it('应该在销毁不存在的 Droplet 时抛出异常', async () => {
      await expect(service.destroyDroplet('non-existent-id')).rejects.toThrow(
        'Droplet 不存在',
      );
    });
  });
});
