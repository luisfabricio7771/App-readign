import type { Page } from '@playwright/test';

// Contract test double only. Production loads the official IFrame API directly.
export async function mockYouTube(page: Page) {
  await page.route('https://www.youtube.com/iframe_api', route => route.fulfill({ contentType: 'application/javascript', body: `
    (() => {
      const test = window.__ytTest = { constructed: 0, destroyed: 0, calls: [], error(code) { test.last.options.events.onError({ data: code }); } };
      class Player {
        constructor(element, options) {
          this.options=options;this.current='M7lc1UVf-VE';this.list=[];
          this.frame=document.createElement('iframe');this.frame.src='https://www.youtube-nocookie.com/embed/test?enablejsapi=1';
          element.replaceWith(this.frame);test.constructed++;test.last=this;
          setTimeout(()=>options.events.onReady({target:this}),20);
        }
        cueVideoById(value) { this.current=value.videoId;this.list=[];test.calls.push('cueVideo');setTimeout(()=>this.options.events.onStateChange({data:5,target:this}),0); }
        loadVideoById(value) { this.cueVideoById(value);this.playVideo(); }
        cuePlaylist(value) { this.list=['M7lc1UVf-VE','dQw4w9WgXcQ'];this.current=this.list[0];test.calls.push('cuePlaylist');setTimeout(()=>this.options.events.onStateChange({data:5,target:this}),0); }
        loadPlaylist(value) { this.cuePlaylist(value);this.playVideo(); }
        playVideo() { test.calls.push('play');test.playing=true;this.options.events.onStateChange({data:1,target:this}); }
        pauseVideo() { test.calls.push('pause');test.playing=false;this.options.events.onStateChange({data:2,target:this}); }
        nextVideo() { test.calls.push('next');this.current=this.list[1];this.playVideo(); }
        setVolume(value) { test.volume=value; }
        getPlaylist() {return this.list;}
        getVideoData() {return {title:'Música de prueba '+this.current,video_id:this.current};}
        getIframe() {return this.frame;}
        destroy() {test.destroyed++;this.frame.remove();}
      }
      window.YT={Player};window.onYouTubeIframeAPIReady();
    })();
  ` }));
  await page.route('https://www.youtube-nocookie.com/**', route => route.fulfill({ contentType: 'text/html', body: '<html><body style="margin:0;background:#111;color:white;display:grid;place-items:center;height:100vh;font:12px sans-serif">YouTube · API de prueba</body></html>' }));
}
