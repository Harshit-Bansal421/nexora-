import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { postApi, pageApi } from '../api/client';
import { useAuth } from '../context/authContextValue';
import { useToast } from '../context/toastContextValue';
import Avatar from '../components/Avatar';

const TOPICS = ['Tech', 'Academic', 'Career', 'Life'];

export default function UploadPostPage() {
  const [searchParams] = useSearchParams();
  const initialPageId = searchParams.get('pageId') || '';
  const navigate = useNavigate();
  const { currentUser, isAuthenticated } = useAuth();
  const { success, error, info } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [topic, setTopic] = useState('Tech');
  const [destination, setDestination] = useState(initialPageId ? 'page' : 'feed');
  const [selectedPageId, setSelectedPageId] = useState(initialPageId);
  const [availablePages, setAvailablePages] = useState([]);

  // Media upload state
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [video, setVideo] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      info('Please log in to create a post.');
      navigate('/login');
    }
  }, [isAuthenticated, navigate, info]);

  useEffect(() => {
    const fetchPages = async () => {
      try {
        const res = await pageApi.getPages({ limit: 50 });
        const data = res?.data || res || [];
        setAvailablePages(Array.isArray(data) ? data : (data?.pages || []));
      } catch (err) {
        console.warn('Could not fetch pages for destination picker', err);
      }
    };
    fetchPages();
  }, []);

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (images.length + files.length > 3) {
      error('You can upload a maximum of 3 images.');
      return;
    }

    const newImages = [...images, ...files].slice(0, 3);
    setImages(newImages);
    const newPreviews = newImages.map((file) => URL.createObjectURL(file));
    setImagePreviews(newPreviews);
  };

  const removeImage = (index) => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
    setImagePreviews(newImages.map((file) => URL.createObjectURL(file)));
  };

  const handleVideoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        error('Video size must be under 50MB.');
        return;
      }
      setVideo(file);
      setVideoPreview(URL.createObjectURL(file));
    }
  };

  const removeVideo = () => {
    setVideo(null);
    setVideoPreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      error('Please provide a title for your request.');
      return;
    }
    if (!description.trim()) {
      error('Please provide details for your question or guide.');
      return;
    }
    if (destination === 'page' && !selectedPageId) {
      error('Please select which community page to post to.');
      return;
    }

    setPublishing(true);

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('topic', topic);

      if (destination === 'page' && selectedPageId) {
        formData.append('pages', selectedPageId);
      }

      images.forEach((img) => {
        formData.append('PostImages', img);
      });

      if (video) {
        formData.append('PostVideos', video);
      }

      const res = await postApi.createPost(formData);
      const created = res?.data || res;
      success('Question published successfully!');

      if (created?._id) {
        const author = currentUser;
        navigate(`/posts/${created._id}/comments`, {
          state: {
            post: {
              ...created,
              owner: author,
              author,
            },
          },
        });
      } else {
        navigate('/feed');
      }
    } catch (err) {
      error(err?.message || 'Failed to publish post. Please check the fields.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-28">
        {/* Top Header */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-outline-variant/15">
          <div className="flex items-center gap-3">
            <Link
              to="/feed"
              className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant transition-colors"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </Link>
            <h1 className="font-headline font-extrabold text-2xl text-on-surface">
              Create a Request or Discussion
            </h1>
          </div>

          <button
            onClick={handleSubmit}
            disabled={publishing}
            className="px-8 py-2.5 bg-gradient-to-br from-primary to-primary-dim text-white font-bold text-xs rounded-full shadow-md hover:brightness-105 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {publishing ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Publishing...</span>
              </>
            ) : (
              <>
                <span>Publish Post</span>
                <span className="material-symbols-outlined text-base">send</span>
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Content Form */}
          <div className="lg:col-span-8 space-y-6">
            {/* Author Snippet */}
            <div className="flex items-center gap-3.5 mb-2">
              <Avatar
                src={currentUser?.profileImage}
                name={currentUser?.username || 'User'}
                className="w-12 h-12 rounded-full object-cover ring-2 ring-primary-container"
              />
              <div>
                <h3 className="font-bold text-sm text-on-surface">{currentUser?.username}</h3>
                <p className="text-xs text-on-surface-variant">
                  Publishing under <span className="text-primary font-semibold">#{topic}</span>
                </p>
              </div>
            </div>

            {/* Input Canvas Box */}
            <div className="bg-surface-container-lowest rounded-3xl p-6 sm:p-8 shadow-stitch-soft border border-outline-variant/15 space-y-6">
              {/* Title Field */}
              <div className="space-y-1">
                <input
                  type="text"
                  maxLength={150}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Give your request a clear, descriptive title..."
                  className="w-full bg-transparent border-none text-xl sm:text-2xl font-headline font-extrabold placeholder:text-outline-variant/60 text-on-surface focus:outline-none focus:ring-0 p-0"
                />
                <div className="flex justify-between text-[11px] text-outline-variant pt-2 border-t border-outline-variant/10">
                  <span>Be specific to get accurate answers from experts</span>
                  <span>{title.length}/150</span>
                </div>
              </div>

              {/* Description Body */}
              <div className="space-y-1">
                <textarea
                  rows={8}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the problem, context, what you've tried, and any code or reference points..."
                  className="w-full bg-transparent border-none text-sm sm:text-base leading-relaxed resize-none placeholder:text-outline-variant/60 text-on-surface focus:outline-none focus:ring-0 p-0"
                />
              </div>

              {/* Image Previews */}
              {imagePreviews.length > 0 && (
                <div className="grid grid-cols-3 gap-3 pt-2">
                  {imagePreviews.map((preview, i) => (
                    <div key={i} className="relative aspect-video rounded-xl overflow-hidden bg-surface-container border border-outline-variant/20 group">
                      <img src={preview} alt="Upload preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute top-1.5 right-1.5 bg-black/60 text-white p-1 rounded-full hover:bg-black/80 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Video Preview */}
              {videoPreview && (
                <div className="relative rounded-xl overflow-hidden bg-black max-h-60 flex items-center justify-center">
                  <video src={videoPreview} controls className="max-h-60 w-full" />
                  <button
                    type="button"
                    onClick={removeVideo}
                    className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-full hover:bg-black/80 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
              )}

              {/* Attachment Actions */}
              <div className="flex flex-wrap gap-3 pt-4 border-t border-outline-variant/15">
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-surface-container-low hover:bg-surface-container rounded-xl text-xs font-bold text-on-surface cursor-pointer transition-colors">
                  <span className="material-symbols-outlined text-lg text-primary">add_photo_alternate</span>
                  <span>Add Images ({images.length}/3)</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>

                {!video && (
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-surface-container-low hover:bg-surface-container rounded-xl text-xs font-bold text-on-surface cursor-pointer transition-colors">
                    <span className="material-symbols-outlined text-lg text-secondary">videocam</span>
                    <span>Add Video (Max 1)</span>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleVideoChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Right Configuration Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            {/* Category Selector */}
            <div className="bg-surface-container-low rounded-3xl p-6 space-y-4 border border-outline-variant/10">
              <h3 className="font-headline font-bold text-sm text-on-surface">Topic Category</h3>
              <div className="flex flex-wrap gap-2">
                {TOPICS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTopic(t)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      topic === t
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-container-lowest'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Publishing Destination */}
            <div className="bg-surface-container-low rounded-3xl p-6 space-y-4 border border-outline-variant/10">
              <h3 className="font-headline font-bold text-sm text-on-surface">Publishing Target</h3>
              <div className="space-y-3">
                <label className="flex items-center justify-between p-3.5 bg-surface-container-lowest rounded-2xl cursor-pointer hover:bg-primary/5 transition-colors border border-outline-variant/10">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary">rss_feed</span>
                    <div>
                      <p className="text-xs font-bold text-on-surface">Public Feed</p>
                      <p className="text-[10px] text-on-surface-variant">Visible across universal community feed</p>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="dest"
                    checked={destination === 'feed'}
                    onChange={() => setDestination('feed')}
                    className="text-primary focus:ring-primary/20"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 bg-surface-container-lowest rounded-2xl cursor-pointer hover:bg-primary/5 transition-colors border border-outline-variant/10">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-secondary">hub</span>
                    <div>
                      <p className="text-xs font-bold text-on-surface">Post to Community Hub</p>
                      <p className="text-[10px] text-on-surface-variant">Share directly to a specific page</p>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="dest"
                    checked={destination === 'page'}
                    onChange={() => setDestination('page')}
                    className="text-primary focus:ring-primary/20"
                  />
                </label>
              </div>

              {destination === 'page' && (
                <div className="pt-2">
                  <label className="text-[11px] font-bold text-on-surface-variant block mb-1">
                    Select Community Hub
                  </label>
                  <select
                    value={selectedPageId}
                    onChange={(e) => setSelectedPageId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-surface-container-lowest border border-outline-variant/20 rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary/40 outline-none"
                  >
                    <option value="">-- Choose a Hub --</option>
                    {availablePages.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.pageName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Quality Guidelines Card */}
            <div className="bg-tertiary-container/15 border border-tertiary/20 rounded-3xl p-5 space-y-2">
              <div className="flex items-center gap-2 text-tertiary font-bold text-xs uppercase tracking-wider">
                <span className="material-symbols-outlined text-base filled">stars</span>
                Tip for Faster Answers
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Include reproduction steps or code snippets. Mentors reward detailed questions with verified badges and fast responses!
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
