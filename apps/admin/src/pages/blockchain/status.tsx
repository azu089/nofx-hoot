/**
 * 区块链监控页面（多链）
 * 实时监控区块链连接状态、各链热钱包余额、启停监听
 *
 * 已对接真实 API:
 * - GET /blockchain/status
 * - POST /blockchain/start
 * - POST /blockchain/stop
 * - GET /blockchain/withdraw-wallet/balance
 */
import { useState, useEffect, useRef } from 'react';
import { List } from '@refinedev/antd';
import {
  Card,
  Row,
  Col,
  Statistic,
  Badge,
  Button,
  Space,
  Tag,
  Typography,
  Alert,
  Tooltip,
  Descriptions,
  Divider,
} from 'antd';
import {
  ReloadOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  CopyOutlined,
  WalletOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { api } from '../../lib/api';
import { useMessage } from '../../hooks';

const { Text } = Typography;

// 后端返回的链状态
interface ChainInfo {
  name: string;
  connected: boolean;
  tokens: string[];
}

interface BlockchainStatus {
  isConnected: boolean;
  isListening: boolean;
  chains: ChainInfo[];
  tronEnabled: boolean;
  cachedAddresses: number;
  hdWallet: boolean;
}

// 单链钱包余额
interface ChainBalance {
  chain: string;
  address: string;
  gasBalance: string;
  gasSymbol: string;
  usdt: string;
  hoot?: string;
}

// 余额 API 返回
interface WalletBalanceResponse {
  chains: ChainBalance[];
}

// 链颜色映射
const CHAIN_COLORS: Record<string, string> = {
  BSC: '#F0B90B',
  ETH: '#627EEA',
  POLYGON: '#8247E5',
  TRON: '#FF0013',
};

export const BlockchainStatusPage = () => {
  const message = useMessage();
  const [status, setStatus] = useState<BlockchainStatus | null>(null);
  const [balances, setBalances] = useState<ChainBalance[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 加载区块链状态
  const fetchStatus = async () => {
    setLoadingStatus(true);
    setError(null);
    try {
      const data = await api.get<BlockchainStatus>('/blockchain/status');
      setStatus(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '获取区块链状态失败');
    } finally {
      setLoadingStatus(false);
    }
  };

  // 加载热钱包余额
  const fetchBalance = async () => {
    setLoadingBalance(true);
    try {
      const data = await api.get<WalletBalanceResponse>('/blockchain/withdraw-wallet/balance');
      setBalances(data.chains || []);
    } catch (err: unknown) {
      console.error('获取热钱包余额失败:', err);
    } finally {
      setLoadingBalance(false);
    }
  };

  // 启动监听
  const handleStart = async () => {
    setStarting(true);
    try {
      await api.post('/blockchain/start', {});
      message.success('区块链监听已启动');
      await fetchStatus();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '启动失败');
    } finally {
      setStarting(false);
    }
  };

  // 停止监听
  const handleStop = async () => {
    setStopping(true);
    try {
      await api.post('/blockchain/stop', {});
      message.success('区块链监听已停止');
      await fetchStatus();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '停止失败');
    } finally {
      setStopping(false);
    }
  };

  // 复制地址
  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    message.success('地址已复制');
  };

  // 初始加载
  useEffect(() => {
    fetchStatus();
    fetchBalance();
  }, []);

  // 自动刷新状态（10 秒）
  useEffect(() => {
    timerRef.current = setInterval(() => {
      fetchStatus();
    }, 10000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // 统计活跃链数量
  const activeChainCount = (status?.chains?.length || 0) + (status?.tronEnabled ? 1 : 0);

  return (
    <List
      title="区块链监控"
      headerButtons={
        <Space>
          <Button
            icon={<ReloadOutlined spin={loadingStatus} />}
            onClick={() => { fetchStatus(); fetchBalance(); }}
          >
            刷新
          </Button>
          {status?.isListening ? (
            <Button
              danger
              icon={<PauseCircleOutlined />}
              loading={stopping}
              onClick={handleStop}
            >
              停止监听
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={starting}
              onClick={handleStart}
            >
              启动监听
            </Button>
          )}
        </Space>
      }
    >
      {/* 错误提示 */}
      {error && (
        <Alert
          message="数据加载失败"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          action={<Button size="small" onClick={fetchStatus}>重试</Button>}
        />
      )}

      {/* 状态概览卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="连接状态"
              value={status?.isConnected ? '已连接' : '未连接'}
              valueStyle={{ color: status?.isConnected ? '#52c41a' : '#ff4d4f' }}
              prefix={status?.isConnected ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              loading={loadingStatus && !status}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="监听状态"
              value={status?.isListening ? '监听中' : '已停止'}
              valueStyle={{ color: status?.isListening ? '#52c41a' : '#faad14' }}
              prefix={status?.isListening ? <ApiOutlined /> : <PauseCircleOutlined />}
              loading={loadingStatus && !status}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="活跃链数"
              value={activeChainCount}
              suffix="条链"
              loading={loadingStatus && !status}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="缓存地址数"
              value={status?.cachedAddresses || 0}
              loading={loadingStatus && !status}
            />
          </Card>
        </Col>
      </Row>

      {/* 各链监控详情 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card title="链监控详情" loading={loadingStatus && !status}>
            {status && (
              <Descriptions column={1} size="small">
                <Descriptions.Item label="HD 钱包">
                  <Tag color={status.hdWallet ? 'green' : 'red'}>
                    {status.hdWallet ? '已初始化' : '未初始化'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="缓存地址">
                  <Text>{status.cachedAddresses} 个</Text>
                </Descriptions.Item>
              </Descriptions>
            )}

            {status && (
              <>
                <Divider style={{ margin: '12px 0' }} />
                <Text strong style={{ marginBottom: 8, display: 'block' }}>EVM 链</Text>
                {(status.chains || []).map((chain) => (
                  <div key={chain.name} style={{ marginBottom: 8, padding: '8px 12px', background: '#fafafa', borderRadius: 6 }}>
                    <Space>
                      <Tag color={CHAIN_COLORS[chain.name] || 'blue'} style={{ minWidth: 70, textAlign: 'center' }}>
                        {chain.name}
                      </Tag>
                      <Badge
                        status={chain.connected ? 'success' : 'error'}
                        text={chain.connected ? '已连接' : '断开'}
                      />
                      <Space size={4} wrap>
                        {chain.tokens.map((t) => (
                          <Tag key={t} color="cyan" style={{ margin: 0 }}>{t}</Tag>
                        ))}
                      </Space>
                    </Space>
                  </div>
                ))}

                <Divider style={{ margin: '12px 0' }} />
                <Text strong style={{ marginBottom: 8, display: 'block' }}>TRON</Text>
                <div style={{ padding: '8px 12px', background: '#fafafa', borderRadius: 6 }}>
                  <Space>
                    <Tag color={CHAIN_COLORS.TRON} style={{ minWidth: 70, textAlign: 'center' }}>
                      TRON
                    </Tag>
                    <Badge
                      status={status.tronEnabled ? 'success' : 'default'}
                      text={status.tronEnabled ? '已启用' : '未配置'}
                    />
                    {status.tronEnabled && <Tag color="cyan">USDT (TRC20)</Tag>}
                  </Space>
                </div>
              </>
            )}
          </Card>
        </Col>

        {/* 热钱包余额（多链） */}
        <Col span={12}>
          <Card
            title={
              <Space>
                <WalletOutlined />
                <span>热钱包余额</span>
              </Space>
            }
            extra={
              <Button
                size="small"
                icon={<ReloadOutlined spin={loadingBalance} />}
                onClick={fetchBalance}
              >
                刷新
              </Button>
            }
            loading={loadingBalance && balances.length === 0}
          >
            {balances.length > 0 ? (
              balances.map((b) => (
                <div key={b.chain} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Space>
                      <Tag color={CHAIN_COLORS[b.chain] || 'blue'} style={{ minWidth: 70, textAlign: 'center' }}>
                        {b.chain}
                      </Tag>
                      <Tooltip title={b.address}>
                        <Text code style={{ fontSize: 12 }}>
                          {b.address.slice(0, 8)}...{b.address.slice(-6)}
                        </Text>
                      </Tooltip>
                      <Button
                        type="text"
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() => copyAddress(b.address)}
                      />
                    </Space>
                  </div>

                  <Row gutter={16}>
                    <Col span={8}>
                      <Statistic
                        title={b.gasSymbol}
                        value={parseFloat(b.gasBalance)}
                        precision={4}
                        valueStyle={{ fontSize: 16 }}
                      />
                    </Col>
                    <Col span={8}>
                      <Statistic
                        title="USDT"
                        value={parseFloat(b.usdt)}
                        precision={2}
                        valueStyle={{ fontSize: 16, color: '#52c41a' }}
                      />
                    </Col>
                    {b.hoot && (
                      <Col span={8}>
                        <Statistic
                          title="HOOT"
                          value={parseFloat(b.hoot)}
                          precision={2}
                          valueStyle={{ fontSize: 16, color: '#06B6D4' }}
                        />
                      </Col>
                    )}
                  </Row>

                  {b.chain !== balances[balances.length - 1]?.chain && (
                    <Divider style={{ margin: '12px 0' }} />
                  )}
                </div>
              ))
            ) : (
              !loadingBalance && (
                <Alert message="无法获取热钱包余额" type="warning" showIcon />
              )
            )}
          </Card>
        </Col>
      </Row>
    </List>
  );
};
