"use client";

import { useEffect, useState } from "react";
import {
  getAds,
  createAd,
  updateAd,
  deleteAd,
  toggleAdStatus,
  type Ad,
  type AdFormData,
} from "@/actions/admin-ads";
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
  Image,
  Video,
  ExternalLink,
  Eye,
  EyeOff,
} from "lucide-react";

const POSITIONS = [
  { value: "top", label: "顶部" },
  { value: "bottom", label: "底部" },
  { value: "left", label: "左侧" },
  { value: "right", label: "右侧" },
];

const PLATFORMS = [
  { value: "all", label: "全平台" },
  { value: "android", label: "Android" },
  { value: "ios", label: "iOS" },
  { value: "windows", label: "Windows" },
  { value: "macos", label: "macOS" },
  { value: "linux", label: "Linux" },
];

export default function AdminAdsPage() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [regionFilter, setRegionFilter] = useState("global");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<Ad | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<AdFormData>({
    title: "",
    description: "",
    media_type: "image",
    media_url: "",
    link_url: "",
    position: "bottom",
    platform: "all",
    region: "global",
    status: "inactive",
    priority: 0,
  });

  useEffect(() => {
    fetchAds();
  }, [regionFilter, statusFilter]);

  async function fetchAds() {
    setLoading(true);
    const data = await getAds(regionFilter, statusFilter);
    setAds(data);
    setLoading(false);
  }

  function openCreateDialog() {
    setEditingAd(null);
    setFormData({
      title: "",
      description: "",
      media_type: "image",
      media_url: "",
      link_url: "",
      position: "bottom",
      platform: "all",
      region: "global",
      status: "inactive",
      priority: 0,
    });
    setDialogOpen(true);
  }

  function openEditDialog(ad: Ad) {
    setEditingAd(ad);
    setFormData({
      title: ad.title,
      description: ad.description || "",
      media_type: ad.media_type,
      media_url: ad.media_url,
      link_url: ad.link_url || "",
      position: ad.position,
      platform: ad.platform,
      region: ad.region,
      status: ad.status,
      priority: ad.priority,
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingAd) {
        await updateAd(editingAd.id, formData, editingAd.region);
      } else {
        await createAd(formData);
      }
      setDialogOpen(false);
      fetchAds();
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(ad: Ad) {
    if (!confirm("确定要删除这个广告吗？")) return;
    await deleteAd(ad.id, ad.region);
    fetchAds();
  }

  async function handleToggleStatus(ad: Ad) {
    const newStatus = ad.status === "active" ? "inactive" : "active";
    await toggleAdStatus(ad.id, newStatus, ad.region);
    fetchAds();
  }

  return (
    <div className="space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">广告管理</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            管理各平台广告位内容
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          新建广告
        </Button>
      </div>

      {/* 筛选器 */}
      <div className="flex flex-wrap gap-4">
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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="active">已上架</SelectItem>
            <SelectItem value="inactive">已下架</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 广告列表 */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : ads.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          暂无广告数据
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ads.map((ad) => (
            <div
              key={ad.id}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
            >
              {/* 预览图 */}
              <div className="aspect-video bg-slate-100 dark:bg-slate-700 relative">
                {ad.media_type === "image" ? (
                  <img
                    src={ad.media_url}
                    alt={ad.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Video className="h-12 w-12 text-slate-400" />
                  </div>
                )}
                <div className="absolute top-2 right-2 flex gap-1">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      ad.status === "active"
                        ? "bg-green-100 text-green-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {ad.status === "active" ? "已上架" : "已下架"}
                  </span>
                </div>
              </div>

              {/* 信息 */}
              <div className="p-4">
                <h3 className="font-semibold truncate">{ad.title}</h3>
                <div className="flex flex-wrap gap-2 mt-2 text-xs text-slate-500">
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">
                    {POSITIONS.find((p) => p.value === ad.position)?.label || ad.position}
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">
                    {ad.region === "global" ? "国际版" : ad.region === "cn" ? "国内版" : "全部"}
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">
                    优先级: {ad.priority}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-3 text-sm text-slate-500">
                  <Eye className="h-4 w-4" />
                  <span>{ad.impressions}</span>
                  <ExternalLink className="h-4 w-4 ml-2" />
                  <span>{ad.clicks}</span>
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleStatus(ad)}
                  >
                    {ad.status === "active" ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(ad)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => handleDelete(ad)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 创建/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle>{editingAd ? "编辑广告" : "新建广告"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>标题 *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>媒体类型</Label>
                <Select
                  value={formData.media_type}
                  onValueChange={(v) => setFormData({ ...formData, media_type: v as "image" | "video" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image">图片</SelectItem>
                    <SelectItem value="video">视频</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>广告位置</Label>
                <Select
                  value={formData.position}
                  onValueChange={(v) => setFormData({ ...formData, position: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POSITIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>媒体URL *</Label>
              <Input
                value={formData.media_url}
                onChange={(e) => setFormData({ ...formData, media_url: e.target.value })}
                placeholder="https://..."
                required
              />
            </div>
            <div>
              <Label>跳转链接</Label>
              <Input
                value={formData.link_url}
                onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    <SelectItem value="all">全部</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>平台</Label>
                <Select
                  value={formData.platform}
                  onValueChange={(v) => setFormData({ ...formData, platform: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>优先级</Label>
                <Input
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
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
                    <SelectItem value="active">上架</SelectItem>
                    <SelectItem value="inactive">下架</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingAd ? "保存" : "创建"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
