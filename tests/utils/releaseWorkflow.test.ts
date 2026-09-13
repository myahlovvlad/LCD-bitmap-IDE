import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('desktop release workflow', () => {
  it('publishes a permanent tagged release from tag pushes and manual dispatches', () => {
    const workflow = fs.readFileSync('.github/workflows/release.yml', 'utf8');

    expect(workflow).toContain('release_tag:');
    expect(workflow).toContain("github.event_name == 'workflow_dispatch'");
    expect(workflow).toContain('tag_name: ${{ env.RELEASE_TAG }}');
    expect(workflow).toContain('target_commitish: ${{ github.sha }}');
    expect(workflow).toContain('release-assets/*');
    expect(workflow).toContain('SHA256SUMS.txt');
  });

  it('pins the same reproducible Rust toolchain for release and CI builds', () => {
    const releaseWorkflow = fs.readFileSync('.github/workflows/release.yml', 'utf8');
    const buildWorkflow = fs.readFileSync('.github/workflows/tauri-build.yml', 'utf8');

    expect(releaseWorkflow).toContain('dtolnay/rust-toolchain@1.96.0');
    expect(buildWorkflow).toContain('dtolnay/rust-toolchain@1.96.0');
    expect(releaseWorkflow).not.toContain('dtolnay/rust-toolchain@stable');
    expect(buildWorkflow).not.toContain('dtolnay/rust-toolchain@stable');
  });
});
