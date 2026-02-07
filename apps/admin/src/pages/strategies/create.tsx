/**
 * 新建策略页面
 * 创建新的交易策略
 */
import { Create } from '@refinedev/antd';
import {
  Card,
  Form,
  Input,
  Select,
  InputNumber,
  Button,
  Space,
  Steps,
  Typography,
  Alert,
  Row,
  Col,
  Switch,
  Upload,
  Divider,
  Tabs,
} from 'antd';
import type { UploadFile } from 'antd';
import {
  SaveOutlined,
  UploadOutlined,
  RocketOutlined,
  SettingOutlined,
  FileTextOutlined,
  CodeOutlined,
  CloudUploadOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMessage } from '../../hooks';

const { TextArea } = Input;
const { Text } = Typography;

export const StrategyCreate = () => {
  const message = useMessage();
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [strategyType, setStrategyType] = useState<string>('');
  const [codeUploadType, setCodeUploadType] = useState<'file' | 'paste'>('file');
  const [strategyCode, setStrategyCode] = useState<string>('');
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const navigate = useNavigate();

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      console.log('创建策略:', values);
      await new Promise((resolve) => setTimeout(resolve, 1500));

      message.success('策略创建成功！');
      navigate('/strategies');
    } catch (error) {
      console.error('创建失败:', error);
      message.error('请填写完整的策略信息');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    {
      title: '基本信息',
      icon: <FileTextOutlined />,
    },
    {
      title: '策略代码',
      icon: <CodeOutlined />,
    },
    {
      title: '交易参数',
      icon: <SettingOutlined />,
    },
    {
      title: '发布设置',
      icon: <RocketOutlined />,
    },
  ];

  const renderStep1 = () => (
    <Card title="基本信息" style={{ marginBottom: 24 }}>
      <Form.Item
        label="策略名称"
        name="name"
        rules={[
          { required: true, message: '请输入策略名称' },
          { min: 2, max: 50, message: '名称长度 2-50 字符' },
        ]}
      >
        <Input placeholder="例如：AI量化策略Alpha" />
      </Form.Item>

      <Form.Item
        label="策略类型"
        name="type"
        rules={[{ required: true, message: '请选择策略类型' }]}
      >
        <Select
          placeholder="选择策略类型"
          onChange={(value) => setStrategyType(value)}
          options={[
            { label: 'AI策略 - 基于 AI 模型自动交易', value: 'ai' },
            { label: '手动策略 - 人工分析发出信号', value: 'manual' },
            { label: '量化策略 - 基于量化模型交易', value: 'quant' },
          ]}
        />
      </Form.Item>

      <Form.Item
        label="支持的交易对"
        name="tradingPairs"
        extra="可选。留空则由 Freqtrade 策略配置决定，用户订阅时可从支持的交易对中选择"
      >
        <Select
          mode="multiple"
          placeholder="留空则继承 Freqtrade 配置（推荐）"
          allowClear
          options={[
            { label: 'BTC/USDT - 比特币', value: 'BTC/USDT' },
            { label: 'ETH/USDT - 以太坊', value: 'ETH/USDT' },
            { label: 'SOL/USDT - Solana', value: 'SOL/USDT' },
            { label: 'BNB/USDT - 币安币', value: 'BNB/USDT' },
            { label: 'XRP/USDT - 瑞波币', value: 'XRP/USDT' },
            { label: 'DOGE/USDT - 狗狗币', value: 'DOGE/USDT' },
            { label: 'ADA/USDT - 艾达币', value: 'ADA/USDT' },
            { label: 'AVAX/USDT - 雪崩', value: 'AVAX/USDT' },
            { label: 'LINK/USDT - Chainlink', value: 'LINK/USDT' },
            { label: 'DOT/USDT - 波卡', value: 'DOT/USDT' },
          ]}
        />
      </Form.Item>

      <Form.Item
        label="风险等级"
        name="riskLevel"
        rules={[{ required: true, message: '请选择风险等级' }]}
      >
        <Select
          placeholder="选择风险等级"
          options={[
            { label: '低风险 - 稳健型，回撤小', value: 'low' },
            { label: '中风险 - 平衡型，收益稳定', value: 'medium' },
            { label: '高风险 - 激进型，高收益高回撤', value: 'high' },
          ]}
        />
      </Form.Item>

      <Form.Item
        label="策略描述"
        name="description"
        rules={[
          { required: true, message: '请输入策略描述' },
          { min: 20, max: 500, message: '描述长度 20-500 字符' },
        ]}
      >
        <TextArea
          rows={4}
          placeholder="详细描述策略的运作方式、特点、适合的投资者类型等"
          showCount
          maxLength={500}
        />
      </Form.Item>

      <Form.Item label="策略封面" name="coverImage">
        <Upload
          maxCount={1}
          listType="picture-card"
          showUploadList={false}
          beforeUpload={() => false}
        >
          <div>
            <UploadOutlined />
            <div style={{ marginTop: 8 }}>上传封面</div>
          </div>
        </Upload>
        <Text type="secondary">建议尺寸 800x400，支持 JPG/PNG</Text>
      </Form.Item>
    </Card>
  );

  // 策略代码上传步骤
  const renderStep2_Code = () => (
    <Card title="策略代码" style={{ marginBottom: 24 }}>
      <Alert
        message="策略代码说明"
        description={
          <div>
            <p>• <strong>量化策略/AI策略</strong>：需要上传 Python 策略文件（基于 Freqtrade 框架）</p>
            <p>• <strong>手动策略</strong>：无需上传代码，由交易员手动发送信号</p>
            <p>• 支持 .py 文件上传，或直接粘贴代码</p>
          </div>
        }
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      {strategyType === 'manual' ? (
        <Alert
          message="手动策略无需上传代码"
          description="手动策略由交易员通过管理后台或 API 手动发送交易信号，无需上传策略代码文件。"
          type="success"
          showIcon
        />
      ) : (
        <>
          <Tabs
            activeKey={codeUploadType}
            onChange={(key) => setCodeUploadType(key as 'file' | 'paste')}
            items={[
              {
                key: 'file',
                label: (
                  <span>
                    <CloudUploadOutlined /> 文件上传
                  </span>
                ),
                children: (
                  <div style={{ marginTop: 16 }}>
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
                        // 读取文件内容
                        const reader = new FileReader();
                        reader.onload = (e) => {
                          setStrategyCode(e.target?.result as string);
                        };
                        reader.readAsText(file);
                        setFileList([file]);
                        return false;
                      }}
                      onRemove={() => {
                        setFileList([]);
                        setStrategyCode('');
                      }}
                    >
                      <p className="ant-upload-drag-icon">
                        <CloudUploadOutlined style={{ fontSize: 48, color: '#06B6D4' }} />
                      </p>
                      <p className="ant-upload-text">点击或拖拽 Python 策略文件到此处</p>
                      <p className="ant-upload-hint">
                        支持 Freqtrade 策略文件 (.py)，文件大小不超过 10MB
                      </p>
                    </Upload.Dragger>
                  </div>
                ),
              },
              {
                key: 'paste',
                label: (
                  <span>
                    <CodeOutlined /> 粘贴代码
                  </span>
                ),
                children: (
                  <div style={{ marginTop: 16 }}>
                    <TextArea
                      rows={20}
                      placeholder={`# 粘贴您的 Freqtrade 策略代码
# 示例结构：

from freqtrade.strategy import IStrategy
import pandas as pd

class MyStrategy(IStrategy):
    # 策略参数
    minimal_roi = {"0": 0.1}
    stoploss = -0.05

    def populate_indicators(self, dataframe, metadata):
        # 添加技术指标
        return dataframe

    def populate_entry_trend(self, dataframe, metadata):
        # 入场条件
        return dataframe

    def populate_exit_trend(self, dataframe, metadata):
        # 出场条件
        return dataframe`}
                      value={strategyCode}
                      onChange={(e) => setStrategyCode(e.target.value)}
                      style={{ fontFamily: 'monospace', fontSize: 13 }}
                    />
                  </div>
                ),
              },
            ]}
          />

          {strategyType === 'ai' && (
            <>
              <Divider />
              <Card title={<><RobotOutlined /> AI 模型配置</>} size="small" style={{ marginTop: 16 }}>
                <Alert
                  message="AI 策略需要额外配置模型参数"
                  type="warning"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item
                      label="AI 模型类型"
                      name="aiModelType"
                      rules={[{ required: strategyType === 'ai', message: '请选择 AI 模型类型' }]}
                    >
                      <Select
                        placeholder="选择模型类型"
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
                      rules={[{ required: strategyType === 'ai', message: '请选择预测周期' }]}
                    >
                      <Select
                        placeholder="选择预测周期"
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
                        placeholder="选择训练数据周期"
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
                        placeholder="选择更新频率"
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
                <Form.Item label="模型文件上传" name="modelFile" extra="上传预训练的模型文件（.h5, .pkl, .onnx）">
                  <Upload
                    accept=".h5,.pkl,.onnx,.pt,.pth"
                    maxCount={1}
                    beforeUpload={() => false}
                  >
                    <Button icon={<UploadOutlined />}>上传模型文件</Button>
                  </Upload>
                </Form.Item>
              </Card>
            </>
          )}
        </>
      )}
    </Card>
  );

  const renderStep3_Params = () => (
    <Card title="交易参数" style={{ marginBottom: 24 }}>
      <Alert
        message="交易参数设置将直接影响策略的收益和风险表现，请根据实际情况谨慎设置"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Row gutter={24}>
        <Col span={12}>
          <Form.Item
            label="止损比例 (%)"
            name="stopLoss"
            rules={[{ required: true, message: '请输入止损比例' }]}
            extra="单笔交易的最大亏损比例"
            initialValue={3}
          >
            <InputNumber
              min={0.1}
              max={50}
              precision={1}
              style={{ width: '100%' }}
              suffix="%"
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="止盈比例 (%)"
            name="takeProfit"
            rules={[{ required: true, message: '请输入止盈比例' }]}
            extra="单笔交易的目标盈利比例"
            initialValue={5}
          >
            <InputNumber
              min={0.1}
              max={100}
              precision={1}
              style={{ width: '100%' }}
              suffix="%"
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={24}>
        <Col span={12}>
          <Form.Item
            label="最大持仓数"
            name="maxPositions"
            rules={[{ required: true, message: '请输入最大持仓数' }]}
            extra="同时持有的最大仓位数量"
            initialValue={3}
          >
            <InputNumber min={1} max={10} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="杠杆倍数"
            name="leverage"
            rules={[{ required: true, message: '请选择杠杆倍数' }]}
            extra="建议新手使用 1x 无杠杆"
            initialValue={1}
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
        </Col>
      </Row>

      <Divider />

      <Row gutter={24}>
        <Col span={12}>
          <Form.Item
            label="最小执行资金 (USDT)"
            name="minCapital"
            rules={[{ required: true, message: '请输入最小资金' }]}
            initialValue={100}
          >
            <InputNumber
              min={10}
              precision={2}
              style={{ width: '100%' }}
              suffix="USDT"
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="最大执行资金 (USDT)"
            name="maxCapital"
            rules={[{ required: true, message: '请输入最大资金' }]}
            initialValue={10000}
          >
            <InputNumber
              min={100}
              precision={2}
              style={{ width: '100%' }}
              suffix="USDT"
            />
          </Form.Item>
        </Col>
      </Row>
    </Card>
  );

  const renderStep4_Publish = () => (
    <Card title="发布设置" style={{ marginBottom: 24 }}>
      <Form.Item
        label="订阅月费 (USDT)"
        name="monthlyFee"
        rules={[{ required: true, message: '请输入订阅月费' }]}
        extra="用户订阅此策略需要支付的月费"
        initialValue={25}
      >
        <InputNumber
          min={0}
          precision={2}
          style={{ width: 200 }}
          suffix="USDT/月"
        />
      </Form.Item>

      <Divider />

      <Form.Item
        label="自动交易"
        name="enableAutoTrade"
        valuePropName="checked"
        extra="开启后策略将自动执行买卖信号"
        initialValue={true}
      >
        <Switch checkedChildren="开启" unCheckedChildren="关闭" />
      </Form.Item>

      <Form.Item
        label="交易通知"
        name="enableNotification"
        valuePropName="checked"
        extra="开启后用户会收到交易信号推送通知"
        initialValue={true}
      >
        <Switch checkedChildren="开启" unCheckedChildren="关闭" />
      </Form.Item>

      <Form.Item
        label="公开展示"
        name="isPublic"
        valuePropName="checked"
        extra="开启后策略会在策略市场公开展示"
        initialValue={true}
      >
        <Switch checkedChildren="公开" unCheckedChildren="私有" />
      </Form.Item>

      <Divider />

      <Form.Item
        label="发布状态"
        name="status"
        rules={[{ required: true, message: '请选择发布状态' }]}
        initialValue="draft"
      >
        <Select
          style={{ width: 200 }}
          options={[
            { label: '保存为草稿', value: 'draft' },
            { label: '提交审核', value: 'pending' },
            { label: '直接上架 (需管理员权限)', value: 'active' },
          ]}
        />
      </Form.Item>

      <Alert
        message="策略审核说明"
        description="新策略需要经过平台审核后才能公开展示。审核周期约 1-3 个工作日，审核通过后将自动上架。"
        type="info"
        showIcon
        style={{ marginTop: 16 }}
      />
    </Card>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderStep1();
      case 1:
        return renderStep2_Code();
      case 2:
        return renderStep3_Params();
      case 3:
        return renderStep4_Publish();
      default:
        return null;
    }
  };

  return (
    <Create
      saveButtonProps={{ style: { display: 'none' } }}
      footerButtons={
        <Space>
          {currentStep > 0 && (
            <Button onClick={() => setCurrentStep(currentStep - 1)}>上一步</Button>
          )}
          {currentStep < steps.length - 1 && (
            <Button type="primary" onClick={() => setCurrentStep(currentStep + 1)}>
              下一步
            </Button>
          )}
          {currentStep === steps.length - 1 && (
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={loading}
              onClick={handleSubmit}
            >
              创建策略
            </Button>
          )}
        </Space>
      }
    >
      <Steps current={currentStep} items={steps} style={{ marginBottom: 32 }} />

      <Form form={form} layout="vertical">
        {renderStepContent()}
      </Form>
    </Create>
  );
};
