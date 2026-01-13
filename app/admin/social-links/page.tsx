"use client";

import { useEffect, useState } from "react";
import {
  getSocialLinks,
  createSocialLink,
  updateSocialLink,
  deleteSocialLink,
  type SocialLink,
  type SocialLinkFormData,
} from "@/actions/admin-social-links";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ExternalLink,
  GripVertical,
} from "lucide-react";

const PLATFORM_TYPES = [
  { value: "twitter", label: "Twitter/X" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "discord", label: "Discord" },
  { value: "telegram", label: "Telegram" },
  { value: "github", label: "GitHub" },
  { value: "wechat", label: "微信" },
  { value: "qq", label: "QQ" },
  { value: "weibo", label: "微博" },
  { value: "bilibili", label: "哔哩哔哩" },
  { value: "website", label: "官网" },
  { value: "other", label: "其他" },
];

export default function AdminSocialLinksPage() {
  const [links, setLinks] = useState<SocialLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [regionFilter, setRegionFilter] = useState("global");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<SocialLink | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<SocialLinkFormData>({
    name: "",
    description: "",
    url: "",
    icon: "",
    platform_type: "website",
    region: "global",
    status: "active",
    sort_order: 0,
  });

  useEffect(() => {
    fetchLinks();
  }, [regionFilter]);

  async function fetchLinks() {
    setLoading(true);
    const data = await getSocialLinks(regionFilter);
    setLinks(data);
    setLoading(false);
  }

  function openCreateDialog() {
    setEditingLink(null);
    setFormData({
      name: "",
      description: "",
      url: "",
      icon: "",
      platform_type: "website",
      region: "global",
      status: "active",
      sort_order: links.length,
    });
    setDialogOpen(true);
  }

  function openEditDialog(link: SocialLink) {
    setEditingLink(link);
    setFormData({
      name: link.name,
      description: link.description || "",
      url: link.url,
      icon: link.icon || "",
      platform_type: link.platform_type,
      region: link.region,
      status: link.status,
      sort_order: link.sort_order,
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingLink) {
        await updateSocialLink(editingLink.id, formData, editingLink.region);
      } else {
        await createSocialLink(formData);
      }
      setDialogOpen(false);
      fetchLinks();
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(link: SocialLink) {
    if (!confirm("确定要删除这个链接吗？")) return;
    await deleteSocialLink(link.id, link.region);
    fetchLinks();
  }

  return (
    <div className="space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">社交链接</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            管理同生态跳转链接
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          新建链接
        </Button>
      </div>

      {/* 筛选器 */}
      <div className="flex gap-4">
        <Select value={regionFilter} onValueChange={setRegionFilter}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="global">国际版</SelectItem>
            <SelectItem value="cn">国内版</SelectItem>
            <SelectItem value="all">全部</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 链接列表 */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : links.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          暂无社交链接
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-sm">排序</th>
                <th className="text-left py-3 px-4 font-medium text-sm">名称</th>
                <th className="text-left py-3 px-4 font-medium text-sm">平台</th>
                <th className="text-left py-3 px-4 font-medium text-sm">区域</th>
                <th className="text-left py-3 px-4 font-medium text-sm">状态</th>
                <th className="text-left py-3 px-4 font-medium text-sm">操作</th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr
                  key={link.id}
                  className="border-t border-slate-100 dark:border-slate-700"
                >
                  <td className="py-3 px-4">
                    <GripVertical className="h-4 w-4 text-slate-400" />
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{link.name}</span>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-400 hover:text-primary"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                    {link.description && (
                      <p className="text-sm text-slate-500 mt-0.5">
                        {link.description}
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-sm">
                      {PLATFORM_TYPES.find((p) => p.value === link.platform_type)?.label || link.platform_type}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm">
                      {link.region === "global" ? "国际版" : "国内版"}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        link.status === "active"
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {link.status === "active" ? "启用" : "禁用"}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(link)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleDelete(link)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 创建/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingLink ? "编辑链接" : "新建链接"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>名称 *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>描述</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div>
              <Label>链接URL *</Label>
              <Input
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://..."
                required
              />
            </div>
            <div>
              <Label>图标URL</Label>
              <Input
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                placeholder="https://... 或图标名称"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>平台类型</Label>
                <Select
                  value={formData.platform_type}
                  onValueChange={(v) => setFormData({ ...formData, platform_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORM_TYPES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>区域</Label>
                <Select
                  value={formData.region}
                  onValueChange={(v) => setFormData({ ...formData, region: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">国际版</SelectItem>
                    <SelectItem value="cn">国内版</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>排序</Label>
                <Input
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>状态</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">启用</SelectItem>
                    <SelectItem value="inactive">禁用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingLink ? "保存" : "创建"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
