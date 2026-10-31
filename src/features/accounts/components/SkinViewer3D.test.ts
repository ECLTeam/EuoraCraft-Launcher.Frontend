import { mount } from '@vue/test-utils'
import { CrouchAnimation, RunningAnimation } from 'skinview3d'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import SkinViewer3D from './SkinViewer3D.vue'

const viewerMocks = vi.hoisted(() => ({
  loadSkin: vi.fn(async () => undefined),
  loadCape: vi.fn(async () => undefined),
  loadPanorama: vi.fn(),
  resetSkin: vi.fn(),
  resetCape: vi.fn(),
  dispose: vi.fn(),
  fxaaQuadDispose: vi.fn(),
  playerRotation: { y: 0 },
  current: null as { autoRotate: boolean; animation: unknown; nameTag: unknown } | null,
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('skinview3d', () => ({
  SkinViewer: class {
    width = 0
    height = 0
    autoRotate = false
    autoRotateSpeed = 0
    animation: unknown = null
    nameTag: unknown = null
    playerObject = { rotation: viewerMocks.playerRotation }
    // three 0.186 把 ShaderPass.fsQuad 改成私有的 _fsQuad，skinview3d 3.4.2 仍按旧字段释放
    fxaaPass = { _fsQuad: { dispose: viewerMocks.fxaaQuadDispose } }
    loadSkin = viewerMocks.loadSkin
    loadCape = viewerMocks.loadCape
    loadPanorama = viewerMocks.loadPanorama
    resetSkin = viewerMocks.resetSkin
    resetCape = viewerMocks.resetCape
    dispose = viewerMocks.dispose

    constructor() {
      viewerMocks.current = this
    }
  },
  IdleAnimation: class {},
  WalkingAnimation: class {},
  RunningAnimation: class {},
  CrouchAnimation: class {},
  WaveAnimation: class {},
  FlyingAnimation: class {},
}))

describe('SkinViewer3D', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    viewerMocks.playerRotation.y = 0
    viewerMocks.current = null
  })

  it('更新皮肤披风并在卸载时释放 WebGL viewer', async () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      }
    )
    const wrapper = mount(SkinViewer3D, {
      props: { skinUrl: 'skin-a', capeUrl: 'cape-a', model: 'slim' },
    })
    await nextTick()
    await nextTick()

    expect(viewerMocks.loadSkin).toHaveBeenCalledWith('skin-a', { model: 'slim' })
    expect(viewerMocks.loadCape).toHaveBeenCalledWith('cape-a', { backEquipment: 'cape' })

    await wrapper.setProps({ skinUrl: 'skin-b', capeUrl: '' })
    await nextTick()
    expect(viewerMocks.loadSkin).toHaveBeenCalledWith('skin-b', { model: 'slim' })
    expect(viewerMocks.resetCape).toHaveBeenCalled()

    wrapper.unmount()
    expect(viewerMocks.dispose).toHaveBeenCalledOnce()
  })

  it('卸载时补齐 three 0.186 改名的 FXAA 字段，正常释放且不抛错', async () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      }
    )
    // 还原 skinview3d 3.4.2 的 dispose 末行：读取 fxaaPass.fsQuad 并释放
    viewerMocks.dispose.mockImplementationOnce(function (this: { fxaaPass: { fsQuad?: { dispose: () => void } } }) {
      this.fxaaPass.fsQuad!.dispose()
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const wrapper = mount(SkinViewer3D)
    await nextTick()
    await nextTick()
    wrapper.unmount()

    expect(viewerMocks.fxaaQuadDispose).toHaveBeenCalledOnce()
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('开启鞘翅渲染时以鞘翅方式加载披风纹理', async () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      }
    )
    const wrapper = mount(SkinViewer3D, {
      props: { capeUrl: 'cape-a', elytra: true },
    })
    await nextTick()
    await nextTick()

    expect(viewerMocks.loadCape).toHaveBeenCalledWith('cape-a', { backEquipment: 'elytra' })

    await wrapper.setProps({ elytra: false })
    await nextTick()
    expect(viewerMocks.loadCape).toHaveBeenCalledWith('cape-a', { backEquipment: 'cape' })

    wrapper.unmount()
  })

  it('支持手动左右旋转并暂停或继续自动旋转', async () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      }
    )
    const wrapper = mount(SkinViewer3D)
    await nextTick()
    await nextTick()

    await wrapper.get('[data-testid="rotate-left"]').trigger('click')
    expect(viewerMocks.playerRotation.y).toBeCloseTo(-Math.PI / 8)
    await wrapper.get('[data-testid="rotate-right"]').trigger('click')
    expect(viewerMocks.playerRotation.y).toBeCloseTo(0)

    await wrapper.get('[data-testid="toggle-auto-rotate"]').trigger('click')
    expect(viewerMocks.current?.autoRotate).toBe(false)
    await wrapper.get('[data-testid="toggle-auto-rotate"]').trigger('click')
    expect(viewerMocks.current?.autoRotate).toBe(true)
  })

  it('支持切换动作动画', async () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      }
    )
    const wrapper = mount(SkinViewer3D)
    await nextTick()
    await nextTick()

    await wrapper.get('[data-testid="animation-run"]').trigger('click')
    expect(viewerMocks.current?.animation).toBeInstanceOf(RunningAnimation)
    await wrapper.get('[data-testid="animation-crouch"]').trigger('click')
    expect(viewerMocks.current?.animation).toBeInstanceOf(CrouchAnimation)
  })

  it('加载场景背景并支持显示玩家标签', async () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      }
    )
    const wrapper = mount(SkinViewer3D, { props: { nameTag: 'Steve' } })
    await nextTick()
    await nextTick()

    expect(viewerMocks.loadPanorama).toHaveBeenCalledWith('/img/skinview3d.jpg')
    expect(viewerMocks.current?.nameTag).toBe('Steve')

    await wrapper.setProps({ nameTag: '' })
    await nextTick()
    expect(viewerMocks.current?.nameTag).toBeNull()

    wrapper.unmount()
  })

  it('渲染鞘翅时显示滑翔动作按钮', async () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      }
    )
    const wrapper = mount(SkinViewer3D)
    await nextTick()
    await nextTick()

    expect(wrapper.find('[data-testid="animation-flying"]').exists()).toBe(false)

    await wrapper.setProps({ elytra: true })
    await nextTick()
    expect(wrapper.find('[data-testid="animation-flying"]').exists()).toBe(true)

    wrapper.unmount()
  })
})
