/**
 * 资金归集管理页面
 * 扫描子钱包余额并执行全量归集到热钱包
 *
 * 已对接真实 API:
 * - GET /blockchain/sweep/scan
 * - POST /blockchain/sweep/execute
 */
import { useState } from 'react';
import { List } from '@refinedev/antd';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Alert,
  Row,
  Col,
  Statistic,
  Modal,
  Result,
} from 'antd';
import {
  ScanOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { api } from '../../lib/api';
import { useMessage } from '../../hooks';

const { Text } = Typography;

interface ScanResult {
  chain: string;
  address: string;
  derivationIndex: number;
  userId: string;
  balances: Array<{
    asset: string;
    amount: string;
  }>;
}

interface SweepResultItem {
  chain: string;
  address: string;
  asset: string;
  amount: string;
  success: boolean;
  txHash?: string;
  error?: string;
}

interface SweepResult {
  results: SweepResultItem[];
  totalSwept: number;
  totalFailed: number;
}

// 链颜色映射
const CHAIN_COLORS: Record<string, string> = {
  BSC: '#F0B90B',
  ETH: '#627EEA',
  POLYGON: '#8247E5',
  TRON: '#FF0013',
};

export const SweepPage = () => {
  const message = useMessage();
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [sweepResult, setSweepResult] = useState<SweepResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 扫描子钱包余额
  const handleScan = async () => {
    setScanning(true);
    setError(null);
    setSweepResult(null);
    try {
      const data = await api.get<ScanResult[]>('/blockchain/sweep/scan');
      setScanResults(data);
      if (data.length === 0) {
        message.info('未发现有余额的子钱包');
      } else {
        message.success(`扫描完成，发现 ${data.length} 个有余额的钱包`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '扫描失败';
      setError(msg);
      message.error(msg);
    } finally {
      setScanning(false);
    }
  };

  // 执行归集
  const handleSweep = () => {
    Modal.confirm({
      title: '确认执行全量归集',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>此操作将把所有扫描到的子钱包资金转入热钱包。</p>
          <p>涉及 <strong>{scanResults.length}</strong> 个钱包地址。</p>
          <Alert
            type="warning"
            message="归集过程需要消耗各链原生代币作为 Gas 费（BNB/ETH/MATIC/TRX）"
            style={{ marginTop: 8 }}
          />
        </div>
      ),
      okText: '确认归集',
      cancelText: '取消',
      okButtonProps: { danger: true },
      async onOk() {
        setSweeping(true);
        setError(null);
        try {
          const data = await api.post<SweepResult>('/blockchain/sweep/execute', {});
          setSweepResult(data);
          if (data.totalFailed === 0) {
            message.success(`归集完成！成功 ${data.totalSwept} 笔`);
          } else {
            message.warning(`归集部分完成：成功 ${data.totalSwept} 笔，失败 ${data.totalFailed} 笔`);
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : '归集执行失败';
          setError(msg);
          message.error(msg);
        } finally {
          setSweeping(false);
        }
      },
    });
  };

  // 扫描结果表格列
  const scanColumns = [
    {
      title: '链',
      dataIndex: 'chain',
      key: 'chain',
      width: 90,
      render: (chain: string) => (
        <Tag color={CHAIN_COLORS[chain] || 'blue'} style={{ minWidth: 60, textAlign: 'center' }}>
          {chain}
        </Tag>
      ),
    },
    {
      title: '地址',
      dataIndex: 'address',
      key: 'address',
      render: (address: string) => (
        <Text code style={{ fontSize: 12 }}>
          {address.slice(0, 8)}...{address.slice(-6)}
        </Text>
      ),
    },
    {
      title: '派生索引',
      dataIndex: 'derivationIndex',
      key: 'derivationIndex',
      width: 100,
    },
    {
      title: '用户 ID',
      dataIndex: 'userId',
      key: 'userId',
      width: 120,
      render: (id: string) => <Text style={{ fontSize: 12 }}>{id.slice(0, 8)}...</Text>,
    },
    {
      title: '余额',
      dataIndex: 'balances',
      key: 'balances',
      render: (balances: ScanResult['balances']) => (
        <Space direction="vertical" size={0}>
          {balances.map((b, idx) => (
            <span key={idx}>
              <Text strong>{parseFloat(b.amount).toFixed(4)}</Text>{' '}
              <Tag color="cyan" style={{ marginLeft: 4 }}>{b.asset}</Tag>
            </span>
          ))}
        </Space>
      ),
    },
  ];

  // 归集结果表格列
  const sweepColumns = [
    {
      title: '链',
      dataIndex: 'chain',
      key: 'chain',
      width: 90,
      render: (chain: string) => (
        <Tag color={CHAIN_COLORS[chain] || 'blue'} style={{ minWidth: 60, textAlign: 'center' }}>
          {chain}
        </Tag>
      ),
    },
    {
      title: '地址',
      dataIndex: 'address',
      key: 'address',
      render: (address: string) => (
        <Text code style={{ fontSize: 12 }}>
          {address.slice(0, 8)}...{address.slice(-6)}
        </Text>
      ),
    },
    {
      title: '资产',
      key: 'assetAmount',
      width: 150,
      render: (_: unknown, record: SweepResultItem) => (
        <span>
          <Text strong>{parseFloat(record.amount).toFixed(4)}</Text>{' '}
          <Tag color="cyan" style={{ marginLeft: 4 }}>{record.asset}</Tag>
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'success',
      key: 'success',
      width: 100,
      render: (success: boolean) =>
        success ? (
          <Tag color="success" icon={<CheckCircleOutlined />}>成功</Tag>
        ) : (
          <Tag color="error" icon={<CloseCircleOutlined />}>失败</Tag>
        ),
    },
    {
      title: '交易哈希 / 错误',
      key: 'detail',
      render: (_: unknown, record: SweepResultItem) =>
        record.success ? (
          record.txHash ? (
            <Text code style={{ fontSize: 12 }}>
              {record.txHash.slice(0, 12)}...{record.txHash.slice(-8)}
            </Text>
          ) : '-'
        ) : (
          <Text type="danger" style={{ fontSize: 12 }}>{record.error}</Text>
        ),
    },
  ];

  return (
    <List
      title="资金归集"
      headerButtons={
        <Space>
          <Button
            type="primary"
            icon={<ScanOutlined />}
            loading={scanning}
            onClick={handleScan}
          >
            扫描余额
          </Button>
          {scanResults.length > 0 && (
            <Button
              icon={<ThunderboltOutlined />}
              loading={sweeping}
              onClick={handleSweep}
              danger
            >
              执行全量归集
            </Button>
          )}
        </Space>
      }
    >
      {/* 错误提示 */}
      {error && (
        <Alert
          message="操作失败"
          description={error}
          type="error"
          showIcon
          closable
          style={{ marginBottom: 16 }}
          onClose={() => setError(null)}
        />
      )}

      {/* 归集结果 */}
      {sweepResult && (
        <Card style={{ marginBottom: 24 }}>
          <Result
            status={sweepResult.totalFailed === 0 ? 'success' : 'warning'}
            title={sweepResult.totalFailed === 0 ? '归集完成' : '归集部分完成'}
          />
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={12}>
              <Statistic
                title="成功归集"
                value={sweepResult.totalSwept}
                suffix="笔"
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
            <Col span={12}>
              <Statistic
                title="失败数量"
                value={sweepResult.totalFailed}
                suffix="笔"
                valueStyle={{ color: sweepResult.totalFailed > 0 ? '#ff4d4f' : undefined }}
              />
            </Col>
          </Row>
          {sweepResult.results.length > 0 && (
            <Table
              dataSource={sweepResult.results}
              columns={sweepColumns}
              rowKey={(r) => `${r.chain}-${r.address}-${r.asset}`}
              size="small"
              pagination={false}
            />
          )}
        </Card>
      )}

      {/* 扫描结果表格 */}
      {scanResults.length > 0 && !sweepResult && (
        <Card title={`扫描结果（${scanResults.length} 个钱包有余额）`}>
          <Table
            dataSource={scanResults}
            columns={scanColumns}
            rowKey={(r) => `${r.chain}-${r.address}`}
            size="small"
            pagination={{ pageSize: 20 }}
          />
        </Card>
      )}

      {/* 空状态 */}
      {scanResults.length === 0 && !sweepResult && !scanning && (
        <Card>
          <Result
            icon={<ScanOutlined style={{ color: '#999' }} />}
            title="点击「扫描余额」开始检测子钱包资金"
            subTitle="扫描将检查所有已分配的充值地址余额"
          />
        </Card>
      )}
    </List>
  );
};
