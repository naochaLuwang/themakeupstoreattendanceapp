package in.themakeupstore.hrm;

import android.app.Activity;
import android.content.Intent;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.OutputStream;

@CapacitorPlugin(name = "ReportFiles")
public class ReportFilesPlugin extends Plugin {
    @PluginMethod
    public void save(PluginCall call) {
        String data = call.getString("data");
        if (data == null || data.length() > 27962028) {
            call.reject("The export is missing or exceeds 20 MB.");
            return;
        }
        File cached = null;
        try {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            if (bytes.length > 20971520) { call.reject("The export exceeds 20 MB."); return; }
            cached = File.createTempFile("hrm-export-", ".tmp", getContext().getCacheDir());
            try (FileOutputStream output = new FileOutputStream(cached)) { output.write(bytes); }
            // Avoid putting a large base64 payload into Android's saved activity state.
            call.getData().remove("data");
            call.getData().put("cacheFile", cached.getName());
            String name = call.getString("name", "makeup-store-report.pdf").replaceAll("[\\\\/\\p{Cntrl}]", "_");
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType(call.getString("mimeType", "application/octet-stream"));
            intent.putExtra(Intent.EXTRA_TITLE, name);
            File exportFile = cached;
            getActivity().runOnUiThread(() -> {
                try { startActivityForResult(call, intent, "saveResult"); }
                catch (Exception error) { exportFile.delete(); call.reject("A document picker is not available.", error); }
            });
        } catch (Exception error) {
            if (cached != null) cached.delete();
            call.reject("Could not prepare the export.", error);
        }
    }

    @ActivityCallback
    private void saveResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        String fileName = call.getString("cacheFile", "");
        if (!fileName.matches("hrm-export-[a-zA-Z0-9_-]+\\.tmp")) {
            call.reject("The temporary export is unavailable.");
            return;
        }
        File cached = new File(getContext().getCacheDir(), fileName);
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            cached.delete();
            JSObject response = new JSObject();
            response.put("cancelled", true);
            call.resolve(response);
            return;
        }
        getBridge().execute(() -> {
            try (FileInputStream input = new FileInputStream(cached);
                 OutputStream output = getContext().getContentResolver().openOutputStream(result.getData().getData())) {
                if (output == null) throw new IllegalStateException("The selected document cannot be written.");
                byte[] buffer = new byte[8192];
                int count;
                while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                call.resolve();
            } catch (Exception error) {
                call.reject("Could not save the export.", error);
            } finally {
                cached.delete();
            }
        });
    }
}
