"use client";

import { Suspense } from "react";
import { Building, Rows3, SquareKanban } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { PageHeader } from "@/components/common/page-header";
import { FieldsSettings } from "@/components/settings/fields-settings";
import { PipelineSettings } from "@/components/settings/pipeline-settings";
import { WorkspaceSettings } from "@/components/settings/workspace-settings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function SettingsTabs() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = params.get("tab") ?? "fields";
  return (
    <Tabs
      value={tab}
      onValueChange={(v) => router.replace(`${pathname}?tab=${v}`, { scroll: false })}
      className="gap-5"
    >
      <TabsList className="w-full justify-start border-b pb-2">
        <TabsTrigger value="fields" data-agent-id="settings-tab-fields">
          <Rows3 /> Fields
        </TabsTrigger>
        <TabsTrigger value="pipelines" data-agent-id="settings-tab-pipelines">
          <SquareKanban /> Pipelines
        </TabsTrigger>
        <TabsTrigger value="workspace" data-agent-id="settings-tab-workspace">
          <Building /> Workspace
        </TabsTrigger>
      </TabsList>
      <TabsContent value="fields">
        <FieldsSettings />
      </TabsContent>
      <TabsContent value="pipelines">
        <PipelineSettings />
      </TabsContent>
      <TabsContent value="workspace">
        <WorkspaceSettings />
      </TabsContent>
    </Tabs>
  );
}

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Settings"
        description="Shape the workspace: fields, pipelines and vocabulary."
      />
      <div className="px-6 pb-12">
        <Suspense>
          <SettingsTabs />
        </Suspense>
      </div>
    </div>
  );
}
