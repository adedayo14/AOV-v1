import * as React from "react";
import { json } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
  Page,
  Card,
  FormLayout,
  Text,
  Checkbox,
  TextField,
  InlineStack,
  Banner,
  Button,
} from "@shopify/polaris";
import { withAuth, withAuthAction } from "../utils/auth.server";
import { getSettings, saveSettings } from "../models/settings.server";

export const loader = withAuth(async ({ auth }) => {
  const shop = auth.session.shop;
  const settings = await getSettings(shop);
  return json({ settings });
});

export const action = withAuthAction(async ({ request, auth }) => {
  const shop = auth.session.shop;
  const formData = await request.formData();
  const raw = Object.fromEntries(formData);

  const processed = {
    enableTitleCaps: raw.enableTitleCaps === "true",
    enableRecommendations: raw.enableRecommendations === "true",
    enableAnalytics: raw.enableAnalytics === "true",
    recommendationsTitle: String(raw.recommendationsTitle || "You might also like"),
  };

  try {
    await saveSettings(shop, processed);
    return json({ success: true });
  } catch (e) {
    console.error("Failed to save settings:", e);
    return json({ success: false, message: "Failed to save settings" }, { status: 500 });
  }
});

export default function SettingsPage() {
  const { settings } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const [form, setForm] = React.useState(() => ({
    enableTitleCaps: !!settings.enableTitleCaps,
    enableRecommendations: !!settings.enableRecommendations,
    enableAnalytics: !!settings.enableAnalytics,
    recommendationsTitle: String(settings.recommendationsTitle || "You might also like"),
  }));

  const onChange = (key: keyof typeof form, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  const onSubmit = () => {
    const fd = new FormData();
    fd.set("enableTitleCaps", String(form.enableTitleCaps));
    fd.set("enableRecommendations", String(form.enableRecommendations));
    fd.set("enableAnalytics", String(form.enableAnalytics));
    fd.set("recommendationsTitle", form.recommendationsTitle);
    fetcher.submit(fd, { method: "post" });
  };

  const isSaving = fetcher.state === "submitting";
  const saveOk = fetcher.data && (fetcher.data as any).success;
  const saveErr = fetcher.data && (fetcher.data as any).success === false;

  return (
    <Page
      title="Cart Uplift Settings"
      primaryAction={{ content: "Save", onAction: onSubmit, loading: isSaving }}
    >
      <InlineStack gap="300">
        {saveOk && <Banner tone="success">Settings saved.</Banner>}
        {saveErr && <Banner tone="critical">{(fetcher.data as any)?.message || "Failed to save settings"}</Banner>}
      </InlineStack>

      <Card>
        <FormLayout>
          <Checkbox
            label="Uppercase titles (cart and recommendations)"
            checked={form.enableTitleCaps}
            onChange={(val) => onChange("enableTitleCaps", val)}
          />
          <Checkbox
            label="Enable recommendations"
            checked={form.enableRecommendations}
            onChange={(val) => onChange("enableRecommendations", val)}
          />
          <Checkbox
            label="Enable analytics tracking"
            checked={form.enableAnalytics}
            onChange={(val) => onChange("enableAnalytics", val)}
          />
          <TextField
            label="Recommendations title"
            value={form.recommendationsTitle}
            onChange={(val) => onChange("recommendationsTitle", val)}
            autoComplete="off"
          />
          <Text as="p" variant="bodySm" tone="subdued">
            This is a minimal settings screen to unblock deployment. The full UI can be restored later.
          </Text>
          <InlineStack>
            <Button variant="primary" onClick={onSubmit} loading={isSaving}>Save settings</Button>
          </InlineStack>
        </FormLayout>
      </Card>
    </Page>
  );
}