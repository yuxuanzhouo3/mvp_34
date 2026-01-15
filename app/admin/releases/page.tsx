"use client";

import { useEffect, useState } from "react";
import {
  getReleases,
  createRelease,
  updateRelease,
  deleteRelease,
  publishRelease,
  type Release,
  type ReleaseFormData,
} from "@/actions/admin-releases";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  Download,
  Rocket,
  Smartphone,
  Monitor,
} from "lucide-react";

const PLATFORMS = [
  { value: "android", label: "Android", icon: Smartphone },
  { value: "ios", label: "iOS", icon: Smartphone },
  { value: "windows", label: "Windows", icon: Monitor },
  { value: "macos", label: "macOS", icon: Monitor },
  { value: "linux", label: "Linux", icon: Monitor },
  { value: "harmonyos", label: "HarmonyOS", icon: Smartphone },
];

function formatFileSize(bytes?: number): string {
  if (!bytes) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export default function AdminReleasesPage() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [regionFilter, setRegionFilter] = useState("global");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRelease, setEditingRelease] = useState<Release | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<ReleaseFormData>({
    version: "",
    version_code: 1,
    title: "",
    description: "",
    release_notes: "",
    download_url: "",
    platform: "android",
    region: "global",
    status: "draft",
    is_force_update: false,
  });

  useEffect(() => {
    fetchReleases();
  }, [regionFilter, platformFilter]);

  async function fetchReleases() {
    setLoading(true);
    const data = await getReleases(regionFilter, platformFilter);
    setReleases(data);
    setLoading(false);
  }

  function openCreateDialog() {
    setEditingRelease(null);
    setFormData({
      version: "",
      version_code: 1,
      title: "",
      description: "",
      release_notes: "",
      download_url: "",
      platform: "android",
      region: "global",
      status: "draft",
      is_force_update: false,
    });
    setDialogOpen(true);
  }

  function openEditDialog(release: Release) {
    setEditingRelease(release);
    setFormData({
      version: release.version,
      version_code: release.version_code,
      title: release.title,
      description: release.description || "",
      release_notes: release.release_notes || "",
      download_url: release.download_url || "",
      download_url_backup: release.download_url_backup || "",
      file_size: release.file_size,
      file_hash: release.file_hash || "",
      platform: release.platform,
      region: release.region,
      status: release.status,
      is_force_update: release.is_force_update,
      min_supported_version: release.min_supported_version || "",
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingRelease) {
        await updateRelease(editingRelease.id, formData, editingRelease.region);
      } else {
        await createRelease(formData);
      }
      setDialogOpen(false);
      fetchReleases();
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(release: Release) {
    if (!confirm("确定要删除这个版本吗？")) return;
    await deleteRelease(release.id, release.region);
    fetchReleases();
  }

  async function handlePublish(release: Release) {
    if (!confirm("确定要发布这个版本吗？")) return;
    await publishRelease(release.id, release.region);
    fetchReleases();
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "published":
        return "bg-green-100 text-green-700";
      case "draft":
        return "bg-yellow-100 text-yellow-700";
      case "deprecated":
        return "bg-slate-100 text-slate-600";
      default:
        return "bg-slate-100 text-slate-600";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "published":
        return "已发布";
      case "draft":
        return "草稿";
      case "deprecated":
        return "已废弃";
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">发布版本</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            管理软件版本发布
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          新建版本
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
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部平台</SelectItem>
            {PLATFORMS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 版本列表 */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : releases.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          暂无版本数据
        </div>
      ) : (
        <>
          {/* 桌面端表格视图 */}
          <div className="hidden md:block bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-700/50">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-sm">版本</th>
                  <th className="text-left py-3 px-4 font-medium text-sm">平台</th>
                  <th className="text-left py-3 px-4 font-medium text-sm">区域</th>
                  <th className="text-left py-3 px-4 font-medium text-sm">大小</th>
                  <th className="text-left py-3 px-4 font-medium text-sm">状态</th>
                  <th className="text-left py-3 px-4 font-medium text-sm">操作</th>
                </tr>
              </thead>
              <tbody>
                {releases.map((release) => (
                  <tr
                    key={release.id}
                    className="border-t border-slate-100 dark:border-slate-700"
                  >
                    <td className="py-3 px-4">
                      <div>
                        <span className="font-medium">{release.version}</span>
                        <span className="text-slate-500 ml-2">
                          ({release.version_code})
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {release.title}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-sm">
                        {PLATFORMS.find((p) => p.value === release.platform)?.label || release.platform}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {release.region === "global" ? "国际版" : "国内版"}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {formatFileSize(release.file_size)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadge(release.status)}`}
                        >
                          {getStatusLabel(release.status)}
                        </span>
                        {release.is_force_update && (
                          <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                            强制更新
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        {release.status === "draft" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePublish(release)}
                            title="发布"
                          >
                            <Rocket className="h-4 w-4" />
                          </Button>
                        )}
                        {release.download_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            title="下载"
                          >
                            <a href={release.download_url} target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(release)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleDelete(release)}
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

          {/* 移动端卡片视图 */}
          <div className="md:hidden space-y-3">
            {releases.map((release) => {
              const PlatformIcon = PLATFORMS.find((p) => p.value === release.platform)?.icon || Monitor;
              return (
                <div
                  key={release.id}
                  className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <PlatformIcon className="h-5 w-5 text-slate-500" />
                      <div>
                        <span className="font-semibold">{release.version}</span>
                        <span className="text-slate-500 text-sm ml-1">({release.version_code})</span>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadge(release.status)}`}
                    >
                      {getStatusLabel(release.status)}
                    </span>
                  </div>

                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{release.title}</p>

                  <div className="flex flex-wrap gap-2 mb-3 text-xs">
                    <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded">
                      {PLATFORMS.find((p) => p.value === release.platform)?.label || release.platform}
                    </span>
                    <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded">
                      {release.region === "global" ? "国际版" : "国内版"}
                    </span>
                    <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded">
                      {formatFileSize(release.file_size)}
                    </span>
                    {release.is_force_update && (
                      <span className="px-2 py-1 bg-red-100 text-red-700 rounded font-medium">
                        强制更新
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                    {release.status === "draft" && (
                      <Button variant="outline" size="sm" onClick={() => handlePublish(release)}>
                        <Rocket className="h-4 w-4 mr-1" />
                        发布
                      </Button>
                    )}
                    {release.download_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={release.download_url} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4 mr-1" />
                          下载
                        </a>
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => openEditDialog(release)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleDelete(release)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* 创建/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle>{editingRelease ? "编辑版本" : "新建版本"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>版本号 *</Label>
                <Input
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  placeholder="1.0.0"
                  required
                />
              </div>
              <div>
                <Label>版本代码 *</Label>
                <Input
                  type="number"
                  value={formData.version_code}
                  onChange={(e) => setFormData({ ...formData, version_code: parseInt(e.target.value) || 1 })}
                  required
                />
              </div>
            </div>
            <div>
              <Label>版本标题 *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="版本更新标题"
                required
              />
            </div>
            <div>
              <Label>版本描述</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div>
              <Label>更新日志</Label>
              <Textarea
                value={formData.release_notes}
                onChange={(e) => setFormData({ ...formData, release_notes: e.target.value })}
                placeholder="支持 Markdown 格式"
                rows={4}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>平台 *</Label>
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
              <div>
                <Label>区域 *</Label>
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
            <div>
              <Label>下载链接</Label>
              <Input
                value={formData.download_url}
                onChange={(e) => setFormData({ ...formData, download_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label>备用下载链接</Label>
              <Input
                value={formData.download_url_backup}
                onChange={(e) => setFormData({ ...formData, download_url_backup: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>文件大小 (字节)</Label>
                <Input
                  type="number"
                  value={formData.file_size || ""}
                  onChange={(e) => setFormData({ ...formData, file_size: parseInt(e.target.value) || undefined })}
                />
              </div>
              <div>
                <Label>文件哈希</Label>
                <Input
                  value={formData.file_hash}
                  onChange={(e) => setFormData({ ...formData, file_hash: e.target.value })}
                  placeholder="MD5 或 SHA256"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    <SelectItem value="draft">草稿</SelectItem>
                    <SelectItem value="published">已发布</SelectItem>
                    <SelectItem value="deprecated">已废弃</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>最低支持版本</Label>
                <Input
                  value={formData.min_supported_version}
                  onChange={(e) => setFormData({ ...formData, min_supported_version: e.target.value })}
                  placeholder="1.0.0"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_force_update}
                onCheckedChange={(checked) => setFormData({ ...formData, is_force_update: checked })}
              />
              <Label>强制更新</Label>
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingRelease ? "保存" : "创建"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
