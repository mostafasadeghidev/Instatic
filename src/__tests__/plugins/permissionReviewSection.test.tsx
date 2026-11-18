

describe('PermissionReviewSection — third-party origins on published pages', () => {
  const manifest: PluginManifest = {
    ...baseManifest,
    permissions: ['frontend.assets'] satisfies PluginPermission[],
    frontend: {
      assets: [],
      origins: { scripts: ['js.example.com'], frames: ['pay.example.com', 'hooks.example.com'] },
    },
  }

  it('lists each origin in plain words on a fresh install', () => {
    render(
      <PermissionReviewSection
        pending={{ manifest }}
        uploading={false}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    )
    const section = screen.getByTestId('permission-review-frontend-origins')
    expect(section.textContent).toContain('May load scripts from js.example.com')
    expect(section.textContent).toContain('May embed frames from pay.example.com')
    expect(section.textContent).toContain('May embed frames from hooks.example.com')
    expect(screen.queryByTestId('frontend-origins-diff-alert')).toBeNull()
  })

  it('flags the origins an upgrade adds and shows the ones it drops', () => {
    const { container } = render(
      <PermissionReviewSection
        pending={{
          manifest,
          upgradeFromVersion: '1.0.0',
          previouslyGrantedPermissions: ['frontend.assets'] satisfies PluginPermission[],
          previousFrontendOrigins: { scripts: ['js.example.com', 'old.example.com'], frames: ['pay.example.com'] },
        }}
        uploading={false}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    )
    expect(screen.getByTestId('frontend-origins-diff-alert').textContent).toContain('1 new third-party host')
    const status = (host: string) =>
      container.querySelector(`[data-frontend-origin="${host}"]`)?.getAttribute('data-status')
    expect(status('hooks.example.com')).toBe('new')
    expect(status('js.example.com')).toBe('existing')
    expect(status('old.example.com')).toBe('dropped')
  })

  it('warns under every wildcard origin, and only there', () => {
    const { container } = render(
      <PermissionReviewSection
        pending={{
          manifest: {
            ...manifest,
            frontend: { assets: [], origins: { scripts: ['js.example.com', '*.js.example.com'] } },
          },
          upgradeFromVersion: '1.0.0',
          previouslyGrantedPermissions: ['frontend.assets'] satisfies PluginPermission[],
          previousFrontendOrigins: { scripts: ['js.example.com'], frames: ['*.old.example.com'] },
        }}
        uploading={false}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    )
    const warning = (host: string) =>
      container.querySelector(`[data-frontend-origin="${host}"] [data-testid="frontend-origin-wildcard-warning"]`)
    expect(warning('*.js.example.com')?.textContent).toContain('Any subdomain of js.example.com')
    expect(warning('js.example.com')).toBeNull()
    // An origin the update drops is going away; nothing to warn about.
    expect(warning('*.old.example.com')).toBeNull()
  })

  it('renders no section when the plugin declares no origins', () => {
    render(
      <PermissionReviewSection
        pending={{ manifest: baseManifest }}
        uploading={false}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    )
    expect(screen.queryByTestId('permission-review-frontend-origins')).toBeNull()
  })
})
