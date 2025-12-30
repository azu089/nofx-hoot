'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Image,
  HelpCircle,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { adminApi } from '@/lib/api';
import { toast } from 'sonner';

type TabType = 'contents' | 'banners' | 'help-docs';

interface ContentItem {
  id: string;
  content_key: string;
  content_type: string;
  title: string | null;
  content: string;
  locale: string;
  is_published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface BannerItem {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string;
  link_url: string | null;
  position: string;
  is_active: boolean;
  sort_order: number;
  link_target?: string;
  button_text?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  created_at?: string;
}

interface HelpDocItem {
  id: string;
  slug: string;
  title: string;
  category: string;
  is_published: boolean;
  sort_order: number;
  view_count?: number;
}

type CmsItem = ContentItem | BannerItem | HelpDocItem;

export default function CmsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('contents');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<CmsItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // 获取内容列表
  const { data: contentsRes, isLoading: contentsLoading } = useQuery({
    queryKey: ['admin', 'cms', 'contents'],
    queryFn: () => adminApi.getCmsContents(),
    enabled: activeTab === 'contents',
  });

  // 获取 Banner 列表
  const { data: bannersRes, isLoading: bannersLoading } = useQuery({
    queryKey: ['admin', 'cms', 'banners'],
    queryFn: () => adminApi.getCmsBanners(),
    enabled: activeTab === 'banners',
  });

  // 获取帮助文档列表
  const { data: helpDocsRes, isLoading: helpDocsLoading } = useQuery({
    queryKey: ['admin', 'cms', 'help-docs'],
    queryFn: () => adminApi.getCmsHelpDocs(),
    enabled: activeTab === 'help-docs',
  });

  // 删除操作
  const deleteMutation = useMutation({
    mutationFn: ({ type, id }: { type: string; id: string }) => {
      switch (type) {
        case 'contents':
          return adminApi.deleteCmsContent(id);
        case 'banners':
          return adminApi.deleteCmsBanner(id);
        case 'help-docs':
          return adminApi.deleteCmsHelpDoc(id);
        default:
          throw new Error('Unknown type');
      }
    },
    onSuccess: () => {
      toast.success('删除成功');
      queryClient.invalidateQueries({ queryKey: ['admin', 'cms'] });
    },
    onError: () => {
      toast.error('删除失败');
    },
  });

  const handleDelete = (type: string, id: string, name: string) => {
    if (confirm(`确定要删除 "${name}" 吗？此操作不可撤销。`)) {
      deleteMutation.mutate({ type, id });
    }
  };

  const handleEdit = (item: CmsItem) => {
    setEditingItem(item);
    setShowModal(true);
  };

  const handleCreate = () => {
    setEditingItem(null);
    setShowModal(true);
  };

  const tabs = [
    { id: 'contents', label: '内容管理', icon: FileText },
    { id: 'banners', label: 'Banner 管理', icon: Image },
    { id: 'help-docs', label: '帮助文档', icon: HelpCircle },
  ];

  const renderContentsTable = () => {
    const contents = contentsRes?.data?.items || [];
    const filteredContents = contents.filter((item: ContentItem) =>
      item.content_key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.title?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#2B3139]">
            <th className="text-left py-4 px-6 text-[#848E9C] font-medium">内容键</th>
            <th className="text-left py-4 px-6 text-[#848E9C] font-medium">标题</th>
            <th className="text-left py-4 px-6 text-[#848E9C] font-medium">类型</th>
            <th className="text-left py-4 px-6 text-[#848E9C] font-medium">状态</th>
            <th className="text-right py-4 px-6 text-[#848E9C] font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {filteredContents.map((item: ContentItem) => (
            <tr
              key={item.id}
              className="border-b border-[#2B3139] last:border-0 hover:bg-[#1E222D]/50"
            >
              <td className="py-4 px-6">
                <span className="text-white font-mono text-sm">{item.content_key}</span>
              </td>
              <td className="py-4 px-6">
                <span className="text-white">{item.title || '-'}</span>
              </td>
              <td className="py-4 px-6">
                <span className="px-2 py-1 bg-[#3772FF]/10 text-[#3772FF] text-xs rounded">
                  {item.content_type}
                </span>
              </td>
              <td className="py-4 px-6">
                {item.is_published ? (
                  <span className="flex items-center gap-1 text-[#00C087] text-sm">
                    <Eye className="w-4 h-4" />
                    已发布
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[#848E9C] text-sm">
                    <EyeOff className="w-4 h-4" />
                    草稿
                  </span>
                )}
              </td>
              <td className="py-4 px-6 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleEdit(item)}
                    className="p-2 text-[#3772FF] hover:bg-[#3772FF]/10 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete('contents', item.id, item.content_key)}
                    className="p-2 text-[#F23645] hover:bg-[#F23645]/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderBannersTable = () => {
    const banners = bannersRes?.data?.items || [];
    const filteredBanners = banners.filter((item: BannerItem) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#2B3139]">
            <th className="text-left py-4 px-6 text-[#848E9C] font-medium">图片</th>
            <th className="text-left py-4 px-6 text-[#848E9C] font-medium">标题</th>
            <th className="text-left py-4 px-6 text-[#848E9C] font-medium">位置</th>
            <th className="text-left py-4 px-6 text-[#848E9C] font-medium">状态</th>
            <th className="text-right py-4 px-6 text-[#848E9C] font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {filteredBanners.map((item: BannerItem) => (
            <tr
              key={item.id}
              className="border-b border-[#2B3139] last:border-0 hover:bg-[#1E222D]/50"
            >
              <td className="py-4 px-6">
                <div className="w-24 h-14 bg-[#1E222D] rounded overflow-hidden">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Image className="w-6 h-6 text-[#5E6673]" />
                    </div>
                  )}
                </div>
              </td>
              <td className="py-4 px-6">
                <div>
                  <p className="text-white">{item.title}</p>
                  {item.subtitle && (
                    <p className="text-[#848E9C] text-sm">{item.subtitle}</p>
                  )}
                </div>
              </td>
              <td className="py-4 px-6">
                <span className="px-2 py-1 bg-[#F7931A]/10 text-[#F7931A] text-xs rounded">
                  {item.position}
                </span>
              </td>
              <td className="py-4 px-6">
                {item.is_active ? (
                  <span className="flex items-center gap-1 text-[#00C087] text-sm">
                    <Eye className="w-4 h-4" />
                    启用
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[#848E9C] text-sm">
                    <EyeOff className="w-4 h-4" />
                    禁用
                  </span>
                )}
              </td>
              <td className="py-4 px-6 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleEdit(item)}
                    className="p-2 text-[#3772FF] hover:bg-[#3772FF]/10 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete('banners', item.id, item.title)}
                    className="p-2 text-[#F23645] hover:bg-[#F23645]/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderHelpDocsTable = () => {
    const docs = helpDocsRes?.data?.items || [];
    const filteredDocs = docs.filter((item: HelpDocItem) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.slug.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#2B3139]">
            <th className="text-left py-4 px-6 text-[#848E9C] font-medium">标题</th>
            <th className="text-left py-4 px-6 text-[#848E9C] font-medium">分类</th>
            <th className="text-left py-4 px-6 text-[#848E9C] font-medium">浏览量</th>
            <th className="text-left py-4 px-6 text-[#848E9C] font-medium">状态</th>
            <th className="text-right py-4 px-6 text-[#848E9C] font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {filteredDocs.map((item: HelpDocItem) => (
            <tr
              key={item.id}
              className="border-b border-[#2B3139] last:border-0 hover:bg-[#1E222D]/50"
            >
              <td className="py-4 px-6">
                <div>
                  <p className="text-white">{item.title}</p>
                  <p className="text-[#5E6673] text-xs font-mono mt-0.5">/{item.slug}</p>
                </div>
              </td>
              <td className="py-4 px-6">
                <span className={`px-2 py-1 text-xs rounded ${
                  item.category === 'faq'
                    ? 'bg-[#3772FF]/10 text-[#3772FF]'
                    : item.category === 'tutorial'
                    ? 'bg-[#00C087]/10 text-[#00C087]'
                    : 'bg-[#F7931A]/10 text-[#F7931A]'
                }`}>
                  {item.category === 'faq' ? '常见问题' :
                   item.category === 'tutorial' ? '教程' : '指南'}
                </span>
              </td>
              <td className="py-4 px-6">
                <span className="text-[#848E9C]">{item.view_count || 0}</span>
              </td>
              <td className="py-4 px-6">
                {item.is_published ? (
                  <span className="flex items-center gap-1 text-[#00C087] text-sm">
                    <Eye className="w-4 h-4" />
                    已发布
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[#848E9C] text-sm">
                    <EyeOff className="w-4 h-4" />
                    草稿
                  </span>
                )}
              </td>
              <td className="py-4 px-6 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleEdit(item)}
                    className="p-2 text-[#3772FF] hover:bg-[#3772FF]/10 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete('help-docs', item.id, item.title)}
                    className="p-2 text-[#F23645] hover:bg-[#F23645]/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const isLoading = activeTab === 'contents' ? contentsLoading :
                    activeTab === 'banners' ? bannersLoading : helpDocsLoading;

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="w-6 h-6" />
            内容管理系统
          </h1>
          <p className="text-[#848E9C] mt-1">管理网站内容、Banner 和帮助文档</p>
        </div>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-[#3772FF] text-white rounded-lg hover:bg-[#2962FF] transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          新建
        </button>
      </div>

      {/* 标签和搜索 */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as TabType);
                  setSearchQuery('');
                }}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                  activeTab === tab.id
                    ? 'bg-[#3772FF] text-white'
                    : 'bg-[#1E222D] text-[#848E9C] hover:text-white hover:bg-[#2B3139]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#5E6673]" />
          <input
            type="text"
            placeholder="搜索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-[#1E222D] border border-[#2B3139] rounded-lg pl-10 pr-4 py-2 text-white text-sm w-64 focus:outline-none focus:border-[#3772FF]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5E6673] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 内容列表 */}
      <div className="bg-[#131722] rounded-xl border border-[#2B3139]">
        {isLoading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-8 h-8 text-[#3772FF] animate-spin mx-auto" />
            <p className="text-[#848E9C] mt-2">加载中...</p>
          </div>
        ) : (
          <>
            {activeTab === 'contents' && renderContentsTable()}
            {activeTab === 'banners' && renderBannersTable()}
            {activeTab === 'help-docs' && renderHelpDocsTable()}
          </>
        )}
      </div>

      {/* 编辑弹窗占位 - 实际应该是一个完整的表单组件 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#131722] rounded-xl border border-[#2B3139] w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-[#2B3139] flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">
                {editingItem ? '编辑' : '新建'}
                {activeTab === 'contents' ? '内容' :
                 activeTab === 'banners' ? 'Banner' : '帮助文档'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-[#2B3139] rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-[#848E9C]" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-[#848E9C] text-center py-8">
                表单功能开发中...
              </p>
            </div>
            <div className="p-6 border-t border-[#2B3139] flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-[#1E222D] text-white rounded-lg hover:bg-[#2B3139] transition-colors"
              >
                取消
              </button>
              <button
                className="px-4 py-2 bg-[#3772FF] text-white rounded-lg hover:bg-[#2962FF] transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
