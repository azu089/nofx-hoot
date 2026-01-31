/**
 * 策略编辑页面
 * 修改策略配置、参数设置、策略代码
 */
import { Edit } from '@refinedev/antd';
import {
  Card,
  Form,
  Input,
  Select,
  InputNumber,
  Button,
  Divider,
  Alert,
  message,
  Modal,
  Switch,
  Row,
  Col,
  Upload,
  Tabs,
  Typography,
} from 'antd';
import type { UploadFile } from 'antd';
import {
  SaveOutlined,
  ExclamationCircleOutlined,
  CodeOutlined,
  CloudUploadOutlined,
  RobotOutlined,
  UploadOutlined,
  EditOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useState } from 'react';

const { TextArea } = Input;
const { Text } = Typography;

// 模拟策略数据
const mockStrategy = {
  id: '1',
  name: 'AI量化策略Alpha',
  creator: 'official',
  type: 'ai',
  tradingPair: 'BTC/USDT',
  status: 'active',
  description:
    'AI 驱动的量化交易策略，基于深度学习模型分析市场趋势，自动执行买卖操作。适合追求稳健收益的投资者。',
  riskLevel: 'medium',
  monthlyFee: 25,
  minCapital: 500,
  maxCapital: 50000,
  // 策略参数
  stopLoss: 3,
  takeProfit: 5,
  maxPositions: 3,
  leverage: 1,
  // 开关
  enableAutoTrade: true,
  enableNotification: true,
  isPublic: true,
  // 策略代码
  strategyCode: `from freqtrade.strategy import IStrategy
import pandas as pd
import talib.abstract as ta

class AIQuantAlpha(IStrategy):
    """
    AI量化策略Alpha
    基于深度学习模型分析市场趋势
    """
    minimal_roi = {"0": 0.05}
    stoploss = -0.03
    timeframe = '1h'

    def populate_indicators(self, dataframe, metadata):
        dataframe['rsi'] = ta.RSI(dataframe, timeperiod=14)
        dataframe['macd'], dataframe['macdsignal'], _ = ta.MACD(dataframe)
        return dataframe

    def populate_entry_trend(self, dataframe, metadata):
        dataframe.loc[
            (dataframe['rsi'] < 30) & (dataframe['macd'] > dataframe['macdsignal']),
            'enter_long'
        ] = 1
        return dataframe

    def populate_exit_trend(self, dataframe, metadata):
        dataframe.loc[
            (dataframe['rsi'] > 70) | (dataframe['macd'] < dataframe['macdsignal']),
            'exit_long'
        ] = 1
        return dataframe`,
  // AI 模型配置
  aiModelType: 'lstm',
  predictionPeriod: '4h',
  trainingPeriod: '6m',
  modelUpdateFreq: 'weekly',
};

export const StrategyEdit = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [strategyCode, setStrategyCode] = useState<string>(mockStrategy.strategyCode);
  const [codeEditMode, setCodeEditMode] = useState<'view' | 'edit'>('view');
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const strategyType = Form.useWatch('type', form) || mockStrategy.type;

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      Modal.confirm({
        title: '确认保存策略配置',
        icon: <ExclamationCircleOutlined />,
        content: (
          <div>
            <p>确定要保存对策略的修改吗？</p>
            <Alert
              message="注意：策略参数的修改将在下一个交易周期生效"
              type="warning"
              showIcon
              style={{ marginTop: 8 }}
            />
          </div>
        ),
        okText: '确认保存',
        cancelText: '取消',
        onOk: async () => {
          console.log('保存策略:', values);
          await new Promise((resolve) => setTimeout(resolve, 1000));
          message.success('策略配置已保存');
        },
      });
    } catch (error) {
      console.error('验证失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Edit
      saveButtonProps={{ style: { display: 'none' } }}
      headerButtons={
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={loading}
          onClick={handleSave}
        >
          保存配置
        </Button>
      }
    >
      <Form form={form} layout="vertical" initialValues={mockStrategy}>
        <Row gutter={24}>
          <Col span={12}>
            {/* 基本信息 */}
            <Card title="基本信息" style={{ marginBottom: 24 }}>
              <Form.Item label="策略ID">
                <Input value={mockStrategy.id} disabled />
              </Form.Item>

              <Form.Item
                label="策略名称"
                name="name"
                rules={[{ required: true, message: '请输入策略名称' }]}
              >
                <Input placeholder="策略名称" />
              </Form.Item>

              <Form.Item
                label="策略类型"
                name="type"
                rules={[{ required: true, message: '请选择策略类型' }]}
              >
                <Select
                  options={[
                    { label: 'AI策略', value: 'ai' },
                    { label: '手动策略', value: 'manual' },
                    { label: '量化策略', value: 'quant' },
                  ]}
                />
              </Form.Item>

              <Form.Item
                label="交易对"
                name="tradingPair"
                rules={[{ required: true, message: '请选择交易对' }]}
              >
                <Select
                  options={[
                    { label: 'BTC/USDT', value: 'BTC/USDT' },
                    { label: 'ETH/USDT', value: 'ETH/USDT' },
                    { label: 'SOL/USDT', value: 'SOL/USDT' },
                    { label: 'BNB/USDT', value: 'BNB/USDT' },
                  ]}
                />
              </Form.Item>

              <Form.Item
                label="风险等级"
                name="riskLevel"
                rules={[{ required: true, message: '请选择风险等级' }]}
              >
                <Select
                  options={[
                    { label: '低风险', value: 'low' },
                    { label: '中风险', value: 'medium' },
                    { label: '高风险', value: 'high' },
                  ]}
                />
              </Form.Item>

              <Form.Item
                label="策略描述"
                name="description"
                rules={[{ required: true, message: '请输入策略描述' }]}
              >
                <TextArea rows={4} placeholder="详细描述策略的运作方式和特点" />
              </Form.Item>
            </Card>

            {/* 费用设置 */}
            <Card title="费用设置">
              <Form.Item
                label="月费 (USDT)"
                name="monthlyFee"
                rules={[{ required: true, message: '请输入月费' }]}
              >
                <InputNumber
                  min={0}
                  precision={2}
                  style={{ width: '100%' }}
                  addonAfter="USDT/月"
                />
              </Form.Item>

              <Form.Item
                label="最小执行资金 (USDT)"
                name="minCapital"
                rules={[{ required: true, message: '请输入最小资金' }]}
              >
                <InputNumber
                  min={0}
                  precision={2}
                  style={{ width: '100%' }}
                  addonAfter="USDT"
                />
              </Form.Item>

              <Form.Item
                label="最大执行资金 (USDT)"
                name="maxCapital"
                rules={[{ required: true, message: '请输入最大资金' }]}
              >
                <InputNumber
                  min={0}
                  precision={2}
                  style={{ width: '100%' }}
                  addonAfter="USDT"
                />
              </Form.Item>
            </Card>
          </Col>

          <Col span={12}>
            {/* 交易参数 */}
            <Card title="交易参数" style={{ marginBottom: 24 }}>
              <Alert
                message="交易参数直接影响策略表现，请谨慎修改"
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
              />

              <Form.Item
                label="止损比例 (%)"
                name="stopLoss"
                rules={[{ required: true, message: '请输入止损比例' }]}
                extra="单笔交易的最大亏损比例"
              >
                <InputNumber
                  min={0.1}
                  max={50}
                  precision={1}
                  style={{ width: '100%' }}
                  addonAfter="%"
                />
              </Form.Item>

              <Form.Item
                label="止盈比例 (%)"
                name="takeProfit"
                rules={[{ required: true, message: '请输入止盈比例' }]}
                extra="单笔交易的目标盈利比例"
              >
                <InputNumber
                  min={0.1}
                  max={100}
                  precision={1}
                  style={{ width: '100%' }}
                  addonAfter="%"
                />
              </Form.Item>

              <Form.Item
                label="最大持仓数"
                name="maxPositions"
                rules={[{ required: true, message: '请输入最大持仓数' }]}
                extra="同时持有的最大仓位数量"
              >
                <InputNumber min={1} max={10} style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item
                label="杠杆倍数"
                name="leverage"
                rules={[{ required: true, message: '请输入杠杆倍数' }]}
                extra="1x = 不使用杠杆"
              >
                <Select
                  options={[
                    { label: '1x (无杠杆)', value: 1 },
                    { label: '2x', value: 2 },
                    { label: '3x', value: 3 },
                    { label: '5x', value: 5 },
                    { label: '10x', value: 10 },
                  ]}
                />
              </Form.Item>
            </Card>

            {/* 功能开关 */}
            <Card title="功能开关">
              <Form.Item
                label="自动交易"
                name="enableAutoTrade"
                valuePropName="checked"
                extra="开启后策略将自动执行买卖信号"
              >
                <Switch checkedChildren="开" unCheckedChildren="关" />
              </Form.Item>

              <Form.Item
                label="交易通知"
                name="enableNotification"
                valuePropName="checked"
                extra="开启后用户会收到交易信号推送"
              >
                <Switch checkedChildren="开" unCheckedChildren="关" />
              </Form.Item>

              <Form.Item
                label="公开展示"
                name="isPublic"
                valuePropName="checked"
                extra="开启后策略会在策略市场展示"
              >
                <Switch checkedChildren="公开" unCheckedChildren="私有" />
              </Form.Item>

              <Divider />

              <Form.Item
                label="策略状态"
                name="status"
                rules={[{ required: true, message: '请选择策略状态' }]}
              >
                <Select
                  options={[
                    { label: '草稿', value: 'draft' },
                    { label: '审核中', value: 'pending' },
                    { label: '运行中', value: 'active' },
                    { label: '已暂停', value: 'paused' },
                    { label: '已下架', value: 'offline' },
                  ]}
                />
              </Form.Item>
            </Card>
          </Col>
        </Row>

        {/* 策略代码编辑 - 只对非手动策略显示 */}
        {strategyType !== 'manual' && (
          <Card
            title={
              <span>
                <CodeOutlined /> 策略代码
              </span>
            }
            style={{ marginTop: 24 }}
            extra={
              <Button
                type={codeEditMode === 'edit' ? 'primary' : 'default'}
                icon={codeEditMode === 'edit' ? <EyeOutlined /> : <EditOutlined />}
                onClick={() => setCodeEditMode(codeEditMode === 'edit' ? 'view' : 'edit')}
              >
                {codeEditMode === 'edit' ? '查看模式' : '编辑模式'}
              </Button>
            }
          >
            <Alert
              message="策略代码修改说明"
              description="修改策略代码后，将在下一个交易周期生效。建议在修改前先在测试环境验证。"
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />

            {codeEditMode === 'view' ? (
              <div
                style={{
                  background: '#1e1e1e',
                  padding: 16,
                  borderRadius: 8,
                  maxHeight: 400,
                  overflow: 'auto',
                }}
              >
                <pre
                  style={{
                    margin: 0,
                    fontFamily: 'Monaco, Consolas, monospace',
                    fontSize: 13,
                    color: '#d4d4d4',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {strategyCode}
                </pre>
              </div>
            ) : (
              <Tabs
                defaultActiveKey="editor"
                items={[
                  {
                    key: 'editor',
                    label: (
                      <span>
                        <EditOutlined /> 在线编辑
                      </span>
                    ),
                    children: (
                      <TextArea
                        rows={20}
                        value={strategyCode}
                        onChange={(e) => setStrategyCode(e.target.value)}
                        style={{
                          fontFamily: 'Monaco, Consolas, monospace',
                          fontSize: 13,
                          background: '#1e1e1e',
                          color: '#d4d4d4',
                        }}
                      />
                    ),
                  },
                  {
                    key: 'upload',
                    label: (
                      <span>
                        <CloudUploadOutlined /> 上传文件
                      </span>
                    ),
                    children: (
                      <Upload.Dragger
                        name="strategyFile"
                        multiple={false}
                        accept=".py"
                        fileList={fileList}
                        beforeUpload={(file) => {
                          const isPython = file.name.endsWith('.py');
                          if (!isPython) {
                            message.error('只能上传 Python (.py) 文件！');
                            return Upload.LIST_IGNORE;
                          }
                          const reader = new FileReader();
                          reader.onload = (e) => {
                            setStrategyCode(e.target?.result as string);
                            message.success('代码已加载，请切换到编辑模式查看');
                          };
                          reader.readAsText(file);
                          setFileList([file]);
                          return false;
                        }}
                        onRemove={() => setFileList([])}
                      >
                        <p className="ant-upload-drag-icon">
                          <CloudUploadOutlined style={{ fontSize: 48, color: '#06B6D4' }} />
                        </p>
                        <p className="ant-upload-text">点击或拖拽新的策略文件以替换</p>
                        <p className="ant-upload-hint">
                          支持 Freqtrade 策略文件 (.py)
                        </p>
                      </Upload.Dragger>
                    ),
                  },
                ]}
              />
            )}

            <div style={{ marginTop: 16 }}>
              <Text type="secondary">
                文件类型：Python (.py) | 最后修改：2025-01-30 14:25:00 | 代码行数：{strategyCode.split('\n').length}
              </Text>
            </div>
          </Card>
        )}

        {/* AI 模型配置 - 只对 AI 策略显示 */}
        {strategyType === 'ai' && (
          <Card
            title={
              <span>
                <RobotOutlined /> AI 模型配置
              </span>
            }
            style={{ marginTop: 24 }}
          >
            <Alert
              message="AI 模型配置"
              description="修改 AI 模型参数可能影响策略表现，建议谨慎调整。"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Row gutter={24}>
              <Col span={12}>
                <Form.Item
                  label="AI 模型类型"
                  name="aiModelType"
                  rules={[{ required: true, message: '请选择模型类型' }]}
                >
                  <Select
                    options={[
                      { label: 'LSTM - 长短期记忆网络', value: 'lstm' },
                      { label: 'Transformer - 注意力机制', value: 'transformer' },
                      { label: 'XGBoost - 梯度提升', value: 'xgboost' },
                      { label: 'LightGBM - 轻量梯度提升', value: 'lightgbm' },
                      { label: '自定义模型', value: 'custom' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="预测周期"
                  name="predictionPeriod"
                  rules={[{ required: true, message: '请选择预测周期' }]}
                >
                  <Select
                    options={[
                      { label: '1小时', value: '1h' },
                      { label: '4小时', value: '4h' },
                      { label: '1天', value: '1d' },
                      { label: '1周', value: '1w' },
                    ]}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={24}>
              <Col span={12}>
                <Form.Item
                  label="训练数据周期"
                  name="trainingPeriod"
                  extra="用于模型训练的历史数据长度"
                >
                  <Select
                    options={[
                      { label: '3个月', value: '3m' },
                      { label: '6个月', value: '6m' },
                      { label: '1年', value: '1y' },
                      { label: '2年', value: '2y' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="模型更新频率"
                  name="modelUpdateFreq"
                  extra="模型重新训练的频率"
                >
                  <Select
                    options={[
                      { label: '每天', value: 'daily' },
                      { label: '每周', value: 'weekly' },
                      { label: '每月', value: 'monthly' },
                      { label: '手动', value: 'manual' },
                    ]}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={24}>
              <Col span={12}>
                <Form.Item
                  label="模型文件"
                  name="modelFile"
                  extra="上传新的预训练模型文件以替换当前模型"
                >
                  <Upload accept=".h5,.pkl,.onnx,.pt,.pth" maxCount={1} beforeUpload={() => false}>
                    <Button icon={<UploadOutlined />}>更新模型文件</Button>
                  </Upload>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="当前模型信息">
                  <div style={{ padding: '8px 12px', background: '#1a1a1a', borderRadius: 4 }}>
                    <Text type="secondary">模型版本: v2.1.0</Text>
                    <br />
                    <Text type="secondary">训练时间: 2025-01-15</Text>
                    <br />
                    <Text type="secondary">准确率: 78.5%</Text>
                  </div>
                </Form.Item>
              </Col>
            </Row>
          </Card>
        )}
      </Form>
    </Edit>
  );
};
