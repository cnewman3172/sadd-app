export default function ExecutivesBrief() {
  const videoId = 'tmr6I43W4BQ';
  return (
    <section className="p-4">
      <div className="rounded overflow-hidden border bg-black">
        <div className="w-full aspect-video">
          <iframe
            className="w-full h-full"
            src={`https://www.youtube-nocookie.com/embed/${videoId}`}
            title="YouTube video player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      </div>
    </section>
  );
}
