import Script from "next/script";

/**
 * GTM 컨테이너 로더 (F-901 / I-719).
 *
 * 데이터 수집은 전부 GTM 태그가 담당한다. 이 컴포넌트는 컨테이너 스크립트를
 * 로드하고 dataLayer 를 초기화할 뿐이고, 어떤 이벤트를 어디로 보내는지는
 * GTM 설정(외부)에 있다. GA4 와 Amplitude 태그를 모두 여기서 관리한다.
 *
 * NEXT_PUBLIC_GTM_ID 가 없으면 아무것도 로드하지 않는다(비활성 기본값).
 */
export function GtmScript({ containerId }: { containerId: string | undefined }) {
  if (!containerId) return null;

  return (
    <Script id="gtm-loader" strategy="afterInteractive">
      {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${containerId}');`}
    </Script>
  );
}