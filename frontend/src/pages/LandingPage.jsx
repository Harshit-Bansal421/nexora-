import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/authContextValue';
import { pageApi, postApi } from '../api/client';
import PostCard from '../components/PostCard';

export default function LandingPage() {
  const { isAuthenticated } = useAuth();

  const [trendingPages, setTrendingPages] = useState([]);
  const [featuredPosts, setFeaturedPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  // If user is already logged in, they can explore or jump to feed
  useEffect(() => {
    let isMounted = true;
    const fetchLandingData = async () => {
      try {
        const [pagesRes, postsRes] = await Promise.allSettled([
          pageApi.getPages({ limit: 4 }),
          postApi.getPosts({ page: 1, limit: 3 }),
        ]);

        if (isMounted) {
          if (pagesRes.status === 'fulfilled') {
            const pagesData = pagesRes.value?.data || pagesRes.value || [];
            setTrendingPages(Array.isArray(pagesData) ? pagesData : pagesData?.posts || pagesData?.pages || []);
          }
          if (postsRes.status === 'fulfilled') {
            const postsData = postsRes.value?.data || postsRes.value || [];
            setFeaturedPosts(Array.isArray(postsData) ? postsData : postsData?.posts || []);
          }
        }
      } catch (err) {
        console.warn('Error loading landing page previews:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchLandingData();
    return () => { isMounted = false; };
  }, []);

  return (
    <div className="min-h-screen bg-surface text-on-surface antialiased flex flex-col">
      {/* Top Navigation */}
      <header className="w-full sticky top-0 z-50 bg-surface/95 backdrop-blur-md flex justify-between items-center px-6 py-4 shadow-stitch-soft border-b border-outline-variant/15">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-dim flex items-center justify-center text-on-primary shadow-sm">
            <span className="material-symbols-outlined text-xl">hub</span>
          </div>
          <span className="text-2xl font-extrabold text-primary font-headline tracking-tight">
            Nexora
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm font-headline">
          <Link to="/feed" className="text-on-surface-variant hover:text-primary font-semibold transition-colors">
            Community Feed
          </Link>
          <Link to="/pages/explore" className="text-on-surface-variant hover:text-primary font-semibold transition-colors">
            Explore Hubs
          </Link>
          <Link to="/search" className="text-on-surface-variant hover:text-primary font-semibold transition-colors">
            Search
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <Link
              to="/feed"
              className="px-5 py-2.5 bg-gradient-to-br from-primary to-primary-dim text-white text-sm font-semibold rounded-full shadow-sm hover:scale-[1.02] active:scale-95 transition-all"
            >
              Go to Feed
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="px-4 py-2 text-sm font-semibold text-primary hover:bg-primary-container/20 rounded-full transition-colors"
              >
                Log In
              </Link>
              <Link
                to="/signup"
                className="px-5 py-2.5 bg-gradient-to-br from-primary to-primary-dim text-white text-sm font-semibold rounded-full shadow-sm hover:scale-[1.02] active:scale-95 transition-all"
              >
                Join Community
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-24 flex-1">
        {/* Hero Section */}
        <section className="relative mb-20 overflow-hidden rounded-[2.5rem] bg-surface-container-low p-8 md:p-16 border border-outline-variant/15 shadow-stitch-ambient">
          <div className="relative z-10 grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6 sm:space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-container text-on-primary-container text-xs font-bold uppercase tracking-wider">
                <span className="material-symbols-outlined text-sm">auto_awesome</span>
                The Collaborative Canvas
              </div>
              <h1 className="font-headline text-4xl sm:text-6xl md:text-7xl font-extrabold text-on-surface leading-[1.1] tracking-tight">
                Ask. Help. <br />
                <span className="text-primary italic font-serif">Earn.</span>
              </h1>
              <p className="text-on-surface-variant text-base sm:text-lg md:text-xl leading-relaxed max-w-lg">
                Join a collaborative community where knowledge is currency. Get the help you need, share what you know, and build recognized credibility.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <Link
                  to="/signup"
                  className="px-8 py-4 bg-gradient-to-br from-primary to-primary-dim text-on-primary font-semibold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all text-center flex items-center justify-center gap-2"
                >
                  <span>Get Started Free</span>
                  <span className="material-symbols-outlined text-lg">arrow_forward</span>
                </Link>
                <Link
                  to="/pages/explore"
                  className="px-8 py-4 bg-surface-container-lowest text-primary font-semibold rounded-xl border border-outline-variant/30 hover:bg-surface-container transition-all text-center"
                >
                  Explore Hubs
                </Link>
              </div>
            </div>

            {/* Asymmetric Hero Graphic */}
            <div className="relative">
              <div className="aspect-square rounded-[2rem] overflow-hidden shadow-2xl rotate-2 hover:rotate-0 transition-transform duration-700 ring-4 ring-white/50">
                <img
                  className="w-full h-full object-cover"
                  src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=900&auto=format&fit=crop&q=80"
                  alt="Young professionals collaborating"
                />
              </div>

              {/* Floating Stat Badges */}
              <div className="absolute -bottom-6 -left-6 bg-surface-container-lowest p-5 rounded-2xl shadow-stitch-modal border border-outline-variant/15 max-w-[200px] animate-bounce-subtle">
                <span className="material-symbols-outlined text-tertiary mb-1 text-2xl">auto_awesome</span>
                <p className="text-2xl font-extrabold font-headline text-on-surface">12.4k+</p>
                <p className="text-xs text-on-surface-variant font-medium">Active Helpers Daily</p>
              </div>

              <div className="absolute -top-6 -right-6 bg-secondary text-on-secondary p-5 rounded-2xl shadow-stitch-modal max-w-[190px]">
                <p className="text-xs font-semibold leading-snug">Verified solutions this week</p>
                <p className="text-3xl font-black mt-1 font-headline">850+</p>
              </div>
            </div>
          </div>

          {/* Decorative ambient blurs */}
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-72 h-72 bg-tertiary/10 rounded-full blur-3xl pointer-events-none" />
        </section>

        {/* The Concept Bento Grid */}
        <section className="mb-24">
          <div className="mb-10 text-center max-w-xl mx-auto">
            <h2 className="font-headline text-3xl sm:text-4xl font-extrabold text-on-surface tracking-tight">
              How Nexora Works
            </h2>
            <p className="text-on-surface-variant mt-2 text-base">
              Peer-to-peer knowledge exchange designed for students and creators.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Ask Card */}
            <div className="group p-8 rounded-3xl bg-surface-container-low hover:bg-surface-container-high transition-all duration-300 border border-outline-variant/10 shadow-stitch-soft">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 text-primary group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-3xl">contact_support</span>
              </div>
              <h3 className="font-headline text-xl font-bold mb-3 text-on-surface">Ask Anything</h3>
              <p className="text-on-surface-variant leading-relaxed text-sm mb-6">
                Post your challenge to specialized hubs. From coding debugging to career transitions, get verified, high-quality answers quickly.
              </p>
              <div className="h-1.5 w-12 bg-primary rounded-full" />
            </div>

            {/* Help Card */}
            <div className="group p-8 rounded-3xl bg-surface-container-low hover:bg-surface-container-high transition-all duration-300 border border-outline-variant/10 shadow-stitch-soft">
              <div className="w-14 h-14 rounded-2xl bg-secondary/10 flex items-center justify-center mb-6 text-secondary group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-3xl">volunteer_activism</span>
              </div>
              <h3 className="font-headline text-xl font-bold mb-3 text-on-surface">Help Others</h3>
              <p className="text-on-surface-variant leading-relaxed text-sm mb-6">
                Share your skills in subjects you love. Mentor peers, guide solutions, and climb the platform ranks from Newcomer to Legend.
              </p>
              <div className="h-1.5 w-12 bg-secondary rounded-full" />
            </div>

            {/* Earn Card */}
            <div className="group p-8 rounded-3xl bg-surface-container-low hover:bg-surface-container-high transition-all duration-300 border border-outline-variant/10 shadow-stitch-soft">
              <div className="w-14 h-14 rounded-2xl bg-tertiary/10 flex items-center justify-center mb-6 text-tertiary group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-3xl">stars</span>
              </div>
              <h3 className="font-headline text-xl font-bold mb-3 text-on-surface">Earn Recognition</h3>
              <p className="text-on-surface-variant leading-relaxed text-sm mb-6">
                Accumulate XP points and verified solution badges for every helpful interaction. Build a showcase of proven expertise.
              </p>
              <div className="h-1.5 w-12 bg-tertiary rounded-full" />
            </div>
          </div>
        </section>

        {/* Trending Hubs Preview */}
        <section className="mb-24">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="font-headline text-2xl sm:text-3xl font-extrabold text-on-surface">
                Community Hubs
              </h2>
              <p className="text-sm text-on-surface-variant mt-1">
                Explore learning hubs created by students and mentors.
              </p>
            </div>
            <Link to="/pages/explore" className="text-primary font-bold text-sm flex items-center gap-1 hover:underline">
              <span>View all hubs</span>
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {loading && [0, 1, 2, 3].map((index) => (
              <div key={index} className="h-60 rounded-2xl bg-surface-container-low animate-pulse" aria-hidden="true" />
            ))}
            {trendingPages.length > 0 ? (
              trendingPages.map((page) => (
                <div
                  key={page._id}
                  className="group overflow-hidden rounded-2xl bg-surface-container-lowest border border-outline-variant/15 hover:shadow-stitch-ambient transition-all duration-300 flex flex-col justify-between"
                >
                  <div className="h-36 overflow-hidden relative bg-surface-container">
                    <img
                      src={page.pageProfileImage || 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=400&auto=format&fit=crop&q=80'}
                      alt={page.pageName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-3 right-3 bg-white/90 dark:bg-black/80 px-2 py-0.5 rounded-full text-[10px] font-bold text-on-surface">
                      {page.type || 'Open'}
                    </div>
                  </div>
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-base text-on-surface font-headline truncate">
                        {page.pageName}
                      </h4>
                      <p className="text-xs text-on-surface-variant line-clamp-2 mt-1">
                        {page.pageDescription || 'A collaborative learning hub.'}
                      </p>
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-outline-variant/10">
                      <span className="text-xs text-on-surface-variant font-medium flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">groups</span>
                        {page.membersCount ?? page.members?.length ?? 0} members
                      </span>
                      <Link
                        to={`/pages/${page._id}`}
                        className="text-xs font-bold text-primary hover:underline"
                      >
                        Visit Hub
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            ) : !loading && (
              <div className="sm:col-span-2 lg:col-span-4 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 text-center">
                <p className="text-sm text-on-surface-variant">No community hubs to show yet.</p>
                <Link to="/pages/explore" className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-primary hover:underline">
                  Explore all hubs
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* Featured Discussions */}
        {featuredPosts.length > 0 && (
          <section className="mb-20">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="font-headline text-2xl sm:text-3xl font-extrabold text-on-surface">
                  Latest Community Questions
                </h2>
                <p className="text-sm text-on-surface-variant mt-1">
                  Recent posts shared by the community.
                </p>
              </div>
              <Link to="/feed" className="text-primary font-bold text-sm flex items-center gap-1 hover:underline">
                <span>View feed</span>
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {featuredPosts.map((post) => (
                <PostCard key={post._id} post={post} />
              ))}
            </div>
          </section>
        )}

        {/* CTA Banner */}
        <section className="rounded-3xl bg-gradient-to-r from-primary to-primary-dim p-8 md:p-14 text-white text-center shadow-stitch-ambient relative overflow-hidden">
          <div className="relative z-10 max-w-2xl mx-auto space-y-6">
            <h2 className="font-headline text-3xl sm:text-5xl font-extrabold tracking-tight">
              Ready to learn and excel together?
            </h2>
            <p className="text-primary-container text-base sm:text-lg">
              Join fellow students on Nexora today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
              <Link
                to="/signup"
                className="px-8 py-3.5 bg-surface-container-lowest text-primary font-bold rounded-full shadow-stitch-soft hover:bg-surface-container-low transition-all active:scale-95 text-sm"
              >
                Create Account Now
              </Link>
              <Link
                to="/login"
                className="px-8 py-3.5 bg-primary-container/20 text-white font-bold rounded-full border border-white/30 hover:bg-white/10 transition-all text-sm"
              >
                Sign In
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-outline-variant/15 py-8 text-center text-xs text-on-surface-variant">
        <p>© 2026 Nexora Platform. All rights reserved.</p>
      </footer>
    </div>
  );
}
