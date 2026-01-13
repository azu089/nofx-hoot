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

type EditingItem = ContentItem | BannerItem | HelpDocItem | null;

// 表单状态类型 - 使用 camelCase 与后端 DTO 匹配
interface ContentFormData {
  contentKey: string;
  contentType: string;
  title: string;
  content: string;
  locale: string;
  isPublished: boolean;
  sortOrder: number;
}

interface BannerFormData {
  title: string;
  subtitle: string;
  imageUrl: string;
  linkUrl: string;
  position: string;
  isActive: boolean;
  sortOrder: number;
}

interface HelpDocFormData {
  slug: string;
  title: string;
  category: string;
  content: string;
  isPublished: boolean;
  sortOrder: number;
}

export default function CmsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('contents');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<EditingItem>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // 表单状态
  const [contentForm, setContentForm] = useState<ContentFormData>({
    contentKey: '',
    contentType: 'text',
    title: '',
    content: '',
    locale: 'zh-CN',
    isPublished: false,
    sortOrder: 0,
  });

  const [bannerForm, setBannerForm] = useState<BannerFormData>({
    title: '',
    subtitle: '',
    imageUrl: '',
    linkUrl: '',
    position: 'home_hero',
    isActive: true,
    sortOrder: 0,
  });

  const [helpDocForm, setHelpDocForm] = useState<HelpDocFormData>({
    slug: '',
    title: '',
    category: 'faq',
    content: '',
    isPublished: false,
    sortOrder: 0,
  });

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

  const handleEdit = (item: ContentItem | BannerItem | HelpDocItem) => {
    setEditingItem(item);
    // 根据类型填充表单 - 后端返回 snake_case，转换为 camelCase
    if (activeTab === 'contents') {
      const contentItem = item as ContentItem;
      setContentForm({
        contentKey: contentItem.content_key,
        contentType: contentItem.content_type,
        title: contentItem.title || '',
        content: contentItem.content,
        locale: contentItem.locale,
        isPublished: contentItem.is_published,
        sortOrder: contentItem.sort_order,
      });
    } else if (activeTab === 'banners') {
      const bannerItem = item as BannerItem;
      setBannerForm({
        title: bannerItem.title,
        subtitle: bannerItem.subtitle || '',
        imageUrl: bannerItem.image_url,
        linkUrl: bannerItem.link_url || '',
        position: bannerItem.position,
        isActive: bannerItem.is_active,
        sortOrder: bannerItem.sort_order,
      });
    } else {
      const helpDoc = item as HelpDocItem;
      setHelpDocForm({
        slug: helpDoc.slug,
        title: helpDoc.title,
        category: helpDoc.category,
        content: '', // 需要单独获取内容
        isPublished: helpDoc.is_published,
        sortOrder: helpDoc.sort_order,
      });
    }
    setShowModal(true);
  };

  const handleCreate = () => {
    setEditingItem(null);
    // 重置表单 - 使用 camelCase 字段名
    setContentForm({
      contentKey: '',
      contentType: 'text',
      title: '',
      content: '',
      locale: 'zh-CN',
      isPublished: false,
      sortOrder: 0,
    });
    setBannerForm({
      title: '',
      subtitle: '',
      imageUrl: '',
      linkUrl: '',
      position: 'home_hero',
      isActive: true,
      sortOrder: 0,
    });
    setHelpDocForm({
      slug: '',
      title: '',
      category: 'faq',
      content: '',
      isPublished: false,
      sortOrder: 0,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (activeTab === 'contents') {
        if (editingItem) {
          await adminApi.updateCmsContent(editingItem.id, contentForm);
        } else {
          await adminApi.createCmsContent(contentForm);
        }
      } else if (activeTab === 'banners') {
        if (editingItem) {
          await adminApi.updateCmsBanner(editingItem.id, bannerForm);
        } else {
          await adminApi.createCmsBanner(bannerForm);
        }
      } else {
        if (editingItem) {
          await adminApi.updateCmsHelpDoc(editingItem.id, helpDocForm);
        } else {
          await adminApi.createCmsHelpDoc(helpDocForm);
        }
      }
      toast.success(editingItem ? '更新成功' : '创建成功');
      queryClient.invalidateQueries({ queryKey: ['admin', 'cms'] });
      setShowModal(false);
    } catch (error) {
      toast.error('操作失败');
    } finally {
      setIsSaving(false);
    }
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
          <tr className="border-b border-border-primary">
            <th className="text-left py-4 px-6 text-text-secondary font-medium">内容键</th>
            <th className="text-left py-4 px-6 text-text-secondary font-medium">标题</th>
            <th className="text-left py-4 px-6 text-text-secondary font-medium">类型</th>
            <th className="text-left py-4 px-6 text-text-secondary font-medium">状态</th>
            <th className="text-right py-4 px-6 text-text-secondary font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {filteredContents.map((item: ContentItem) => (
            <tr
              key={item.id}
              className="border-b border-border-primary last:border-0 hover:bg-bg-tertiary/50"
            >
              <td className="py-4 px-6">
                <span className="text-white font-mono text-sm">{item.content_key}</span>
              </td>
              <td className="py-4 px-6">
                <span className="text-white">{item.title || '-'}</span>
              </td>
              <td className="py-4 px-6">
                <span className="px-2 py-1 bg-brand-primary/10 text-brand-primary text-xs rounded">
                  {item.content_type}
                </span>
              </td>
              <td className="py-4 px-6">
                {item.is_published ? (
                  <span className="flex items-center gap-1 text-success text-sm">
                    <Eye className="w-4 h-4" />
                    已发布
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-text-secondary text-sm">
                    <EyeOff className="w-4 h-4" />
                    草稿
                  </span>
                )}
              </td>
              <td className="py-4 px-6 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleEdit(item)}
                    className="p-2 text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete('contents', item.id, item.content_key)}
                    className="p-2 text-danger hover:bg-danger/10 rounded-lg transition-colors"
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
          <tr className="border-b border-border-primary">
            <th className="text-left py-4 px-6 text-text-secondary font-medium">图片</th>
            <th className="text-left py-4 px-6 text-text-secondary font-medium">标题</th>
            <th className="text-left py-4 px-6 text-text-secondary font-medium">位置</th>
            <th className="text-left py-4 px-6 text-text-secondary font-medium">状态</th>
            <th className="text-right py-4 px-6 text-text-secondary font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {filteredBanners.map((item: BannerItem) => (
            <tr
              key={item.id}
              className="border-b border-border-primary last:border-0 hover:bg-bg-tertiary/50"
            >
              <td className="py-4 px-6">
                <div className="w-24 h-14 bg-bg-tertiary rounded overflow-hidden">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Image className="w-6 h-6 text-text-tertiary" />
                    </div>
                  )}
                </div>
              </td>
              <td className="py-4 px-6">
                <div>
                  <p className="text-white">{item.title}</p>
                  {item.subtitle && (
                    <p className="text-text-secondary text-sm">{item.subtitle}</p>
                  )}
                </div>
              </td>
              <td className="py-4 px-6">
                <span className="px-2 py-1 bg-warning/10 text-warning text-xs rounded">
                  {item.position}
                </span>
              </td>
              <td className="py-4 px-6">
                {item.is_active ? (
                  <span className="flex items-center gap-1 text-success text-sm">
                    <Eye className="w-4 h-4" />
                    启用
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-text-secondary text-sm">
                    <EyeOff className="w-4 h-4" />
                    禁用
                  </span>
                )}
              </td>
              <td className="py-4 px-6 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleEdit(item)}
                    className="p-2 text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete('banners', item.id, item.title)}
                    className="p-2 text-danger hover:bg-danger/10 rounded-lg transition-colors"
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
          <tr className="border-b border-border-primary">
            <th className="text-left py-4 px-6 text-text-secondary font-medium">标题</th>
            <th className="text-left py-4 px-6 text-text-secondary font-medium">分类</th>
            <th className="text-left py-4 px-6 text-text-secondary font-medium">浏览量</th>
            <th className="text-left py-4 px-6 text-text-secondary font-medium">状态</th>
            <th className="text-right py-4 px-6 text-text-secondary font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {filteredDocs.map((item: HelpDocItem) => (
            <tr
              key={item.id}
              className="border-b border-border-primary last:border-0 hover:bg-bg-tertiary/50"
            >
              <td className="py-4 px-6">
                <div>
                  <p className="text-white">{item.title}</p>
                  <p className="text-text-tertiary text-xs font-mono mt-0.5">/{item.slug}</p>
                </div>
              </td>
              <td className="py-4 px-6">
                <span className={`px-2 py-1 text-xs rounded ${
                  item.category === 'faq'
                    ? 'bg-brand-primary/10 text-brand-primary'
                    : item.category === 'tutorial'
                    ? 'bg-success/10 text-success'
                    : 'bg-warning/10 text-warning'
                }`}>
                  {item.category === 'faq' ? '常见问题' :
                   item.category === 'tutorial' ? '教程' : '指南'}
                </span>
              </td>
              <td className="py-4 px-6">
                <span className="text-text-secondary">{item.view_count || 0}</span>
              </td>
              <td className="py-4 px-6">
                {item.is_published ? (
                  <span className="flex items-center gap-1 text-success text-sm">
                    <Eye className="w-4 h-4" />
                    已发布
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-text-secondary text-sm">
                    <EyeOff className="w-4 h-4" />
                    草稿
                  </span>
                )}
              </td>
              <td className="py-4 px-6 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleEdit(item)}
                    className="p-2 text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete('help-docs', item.id, item.title)}
                    className="p-2 text-danger hover:bg-danger/10 rounded-lg transition-colors"
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
          <p className="text-text-secondary mt-1">管理网站内容、Banner 和帮助文档</p>
        </div>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary transition-colors flex items-center gap-2"
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
                    ? 'bg-brand-primary text-white'
                    : 'bg-bg-tertiary text-text-secondary hover:text-white hover:bg-bg-tertiary'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            placeholder="搜索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-bg-tertiary border border-border-primary rounded-lg pl-10 pr-4 py-2 text-white text-sm w-64 focus:outline-none focus:border-brand-primary"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 内容列表 */}
      <div className="glass-card">
        {isLoading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-8 h-8 text-brand-primary animate-spin mx-auto" />
            <p className="text-text-secondary mt-2">加载中...</p>
          </div>
        ) : (
          <>
            {activeTab === 'contents' && renderContentsTable()}
            {activeTab === 'banners' && renderBannersTable()}
            {activeTab === 'help-docs' && renderHelpDocsTable()}
          </>
        )}
      </div>

      {/* 编辑弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-secondary rounded-xl border border-border-primary w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-border-primary flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">
                {editingItem ? '编辑' : '新建'}
                {activeTab === 'contents' ? '内容' :
                 activeTab === 'banners' ? 'Banner' : '帮助文档'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-text-secondary" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* 内容表单 */}
              {activeTab === 'contents' && (
                <>
                  <div>
                    <label className="block text-text-secondary text-sm mb-2">内容键 *</label>
                    <input
                      type="text"
                      value={contentForm.contentKey}
                      onChange={(e) => setContentForm({ ...contentForm, contentKey: e.target.value })}
                      className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white focus:outline-none focus:border-brand-primary"
                      placeholder="例如: landing.hero.title"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-text-secondary text-sm mb-2">内容类型</label>
                      <select
                        value={contentForm.contentType}
                        onChange={(e) => setContentForm({ ...contentForm, contentType: e.target.value })}
                        className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white focus:outline-none"
                      >
                        <option value="text">文本</option>
                        <option value="richtext">富文本</option>
                        <option value="json">JSON</option>
                        <option value="image">图片</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-text-secondary text-sm mb-2">语言</label>
                      <select
                        value={contentForm.locale}
                        onChange={(e) => setContentForm({ ...contentForm, locale: e.target.value })}
                        className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white focus:outline-none"
                      >
                        <option value="zh-CN">中文</option>
                        <option value="en">English</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-text-secondary text-sm mb-2">标题</label>
                    <input
                      type="text"
                      value={contentForm.title}
                      onChange={(e) => setContentForm({ ...contentForm, title: e.target.value })}
                      className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white focus:outline-none focus:border-brand-primary"
                      placeholder="内容标题（可选）"
                    />
                  </div>
                  <div>
                    <label className="block text-text-secondary text-sm mb-2">内容 *</label>
                    <textarea
                      value={contentForm.content}
                      onChange={(e) => setContentForm({ ...contentForm, content: e.target.value })}
                      rows={6}
                      className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white focus:outline-none focus:border-brand-primary"
                      placeholder="输入内容..."
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={contentForm.isPublished}
                        onChange={(e) => setContentForm({ ...contentForm, isPublished: e.target.checked })}
                        className="w-4 h-4 rounded bg-bg-tertiary border-border-primary"
                      />
                      <span className="text-white">发布</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <label className="text-text-secondary text-sm">排序:</label>
                      <input
                        type="number"
                        value={contentForm.sortOrder}
                        onChange={(e) => setContentForm({ ...contentForm, sortOrder: parseInt(e.target.value) || 0 })}
                        className="w-20 px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-white text-center"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Banner 表单 */}
              {activeTab === 'banners' && (
                <>
                  <div>
                    <label className="block text-text-secondary text-sm mb-2">标题 *</label>
                    <input
                      type="text"
                      value={bannerForm.title}
                      onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })}
                      className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white focus:outline-none focus:border-brand-primary"
                      placeholder="Banner 标题"
                    />
                  </div>
                  <div>
                    <label className="block text-text-secondary text-sm mb-2">副标题</label>
                    <input
                      type="text"
                      value={bannerForm.subtitle}
                      onChange={(e) => setBannerForm({ ...bannerForm, subtitle: e.target.value })}
                      className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white focus:outline-none focus:border-brand-primary"
                      placeholder="Banner 副标题（可选）"
                    />
                  </div>
                  <div>
                    <label className="block text-text-secondary text-sm mb-2">图片 URL *</label>
                    <input
                      type="text"
                      value={bannerForm.imageUrl}
                      onChange={(e) => setBannerForm({ ...bannerForm, imageUrl: e.target.value })}
                      className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white focus:outline-none focus:border-brand-primary"
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <label className="block text-text-secondary text-sm mb-2">链接 URL</label>
                    <input
                      type="text"
                      value={bannerForm.linkUrl}
                      onChange={(e) => setBannerForm({ ...bannerForm, linkUrl: e.target.value })}
                      className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white focus:outline-none focus:border-brand-primary"
                      placeholder="点击跳转地址（可选）"
                    />
                  </div>
                  <div>
                    <label className="block text-text-secondary text-sm mb-2">展示位置</label>
                    <select
                      value={bannerForm.position}
                      onChange={(e) => setBannerForm({ ...bannerForm, position: e.target.value })}
                      className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white focus:outline-none"
                    >
                      <option value="home_hero">首页 Hero</option>
                      <option value="home_promo">首页推广</option>
                      <option value="login_side">登录侧边</option>
                      <option value="dashboard_top">仪表盘顶部</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bannerForm.isActive}
                        onChange={(e) => setBannerForm({ ...bannerForm, isActive: e.target.checked })}
                        className="w-4 h-4 rounded bg-bg-tertiary border-border-primary"
                      />
                      <span className="text-white">启用</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <label className="text-text-secondary text-sm">排序:</label>
                      <input
                        type="number"
                        value={bannerForm.sortOrder}
                        onChange={(e) => setBannerForm({ ...bannerForm, sortOrder: parseInt(e.target.value) || 0 })}
                        className="w-20 px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-white text-center"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* 帮助文档表单 */}
              {activeTab === 'help-docs' && (
                <>
                  <div>
                    <label className="block text-text-secondary text-sm mb-2">URL 别名 *</label>
                    <input
                      type="text"
                      value={helpDocForm.slug}
                      onChange={(e) => setHelpDocForm({ ...helpDocForm, slug: e.target.value })}
                      className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white focus:outline-none focus:border-brand-primary"
                      placeholder="例如: how-to-start"
                    />
                  </div>
                  <div>
                    <label className="block text-text-secondary text-sm mb-2">标题 *</label>
                    <input
                      type="text"
                      value={helpDocForm.title}
                      onChange={(e) => setHelpDocForm({ ...helpDocForm, title: e.target.value })}
                      className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white focus:outline-none focus:border-brand-primary"
                      placeholder="文档标题"
                    />
                  </div>
                  <div>
                    <label className="block text-text-secondary text-sm mb-2">分类</label>
                    <select
                      value={helpDocForm.category}
                      onChange={(e) => setHelpDocForm({ ...helpDocForm, category: e.target.value })}
                      className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white focus:outline-none"
                    >
                      <option value="faq">常见问题</option>
                      <option value="tutorial">教程</option>
                      <option value="guide">指南</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-text-secondary text-sm mb-2">内容 * (Markdown)</label>
                    <textarea
                      value={helpDocForm.content}
                      onChange={(e) => setHelpDocForm({ ...helpDocForm, content: e.target.value })}
                      rows={10}
                      className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg text-white focus:outline-none focus:border-brand-primary font-mono text-sm"
                      placeholder="# 标题&#10;&#10;内容..."
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={helpDocForm.isPublished}
                        onChange={(e) => setHelpDocForm({ ...helpDocForm, isPublished: e.target.checked })}
                        className="w-4 h-4 rounded bg-bg-tertiary border-border-primary"
                      />
                      <span className="text-white">发布</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <label className="text-text-secondary text-sm">排序:</label>
                      <input
                        type="number"
                        value={helpDocForm.sortOrder}
                        onChange={(e) => setHelpDocForm({ ...helpDocForm, sortOrder: parseInt(e.target.value) || 0 })}
                        className="w-20 px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-white text-center"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="p-6 border-t border-border-primary flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-bg-tertiary text-white rounded-lg hover:bg-bg-tertiary transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary transition-colors disabled:opacity-50"
              >
                {isSaving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
