/**
 * DigitalOcean 服务手动测试脚本（沙盒模式）
 *
 * 运行方式：
 * cd /Users/azu/主QuantFi/apps/api
 * npx ts-node test-digitalocean.ts
 */

import { ConfigService } from '@nestjs/config';
import { DigitalOceanService } from './src/modules/digitalocean/digitalocean.service';

async function main() {
  console.log('=== DigitalOcean 服务测试（沙盒模式）===\n');

  // 创建 Mock ConfigService
  const configService = {
    get: (key: string) => {
      const config: Record<string, string> = {
        DO_API_TOKEN: 'sandbox-test-token',
        DO_SANDBOX_MODE: 'true',
        DO_DEFAULT_REGION: 'sgp1',
        DO_DEFAULT_SIZE: 's-1vcpu-1gb',
        DO_DEFAULT_IMAGE: 'docker-20-04',
      };
      return config[key];
    },
  } as ConfigService;

  const service = new DigitalOceanService(configService);

  try {
    // 1. 创建 Droplet
    console.log('1️⃣  创建 Droplet...');
    const droplet1 = await service.createDroplet({
      name: 'test-vps-1',
      tags: ['quantfi', 'test'],
    });
    console.log('✅ 创建成功:', {
      id: droplet1.id,
      name: droplet1.name,
      ip: droplet1.ip,
      status: droplet1.status,
    });
    console.log('');

    // 2. 再创建一个
    console.log('2️⃣  创建第二个 Droplet...');
    const droplet2 = await service.createDroplet({
      name: 'test-vps-2',
    });
    console.log('✅ 创建成功:', {
      id: droplet2.id,
      name: droplet2.name,
      ip: droplet2.ip,
    });
    console.log('');

    // 3. 查询单个 Droplet
    console.log('3️⃣  查询 Droplet...');
    const fetched = await service.getDroplet(droplet1.id);
    console.log('✅ 查询成功:', {
      id: fetched.id,
      name: fetched.name,
      status: fetched.status,
    });
    console.log('');

    // 4. 列出所有 Droplet
    console.log('4️⃣  列出所有 Droplet...');
    const list = await service.listDroplets();
    console.log(`✅ 找到 ${list.total} 个 Droplet:`);
    list.droplets.forEach((d, i) => {
      console.log(`   ${i + 1}. ${d.name} (${d.id}) - ${d.ip}`);
    });
    console.log('');

    // 5. 销毁 Droplet
    console.log('5️⃣  销毁 Droplet...');
    await service.destroyDroplet(droplet1.id);
    console.log(`✅ 已销毁: ${droplet1.id}`);
    console.log('');

    // 6. 验证已销毁
    console.log('6️⃣  验证已销毁...');
    try {
      await service.getDroplet(droplet1.id);
      console.error('❌ 错误：应该查询不到已销毁的 Droplet');
    } catch (error) {
      console.log('✅ 确认已销毁（查询失败）');
    }
    console.log('');

    // 7. 再次列出（应该只剩一个）
    console.log('7️⃣  再次列出...');
    const list2 = await service.listDroplets();
    console.log(`✅ 剩余 ${list2.total} 个 Droplet`);
    console.log('');

    console.log('🎉 所有测试通过！');
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    process.exit(1);
  }
}

main();
