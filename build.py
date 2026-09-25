import json,os,html,re,shutil
import editorial
import photography
from pathlib import Path
from PIL import Image
R=Path(__file__).parent; D=R/'dist'; SRC=R/'src'
pages=json.load(open(R/'content.json',encoding='utf-8')); projects=pages[:7]
SITE='https://goldcoastbld.com'
SOCIAL='/assets/og-image.jpg'      # og:image — built at 1200x630 below
SITEMAP=[]                          # filled by shell(), written at the end
FONTS=('<link rel="preconnect" href="https://fonts.googleapis.com">'
 '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
 '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?'
 'family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap">')
def _block(obj):
 # json.dumps does not escape '<', so a value containing '</script>' would
 # close this block and everything after it would parse as markup. Escaping
 # the three markup-significant characters keeps the payload inert while
 # staying valid JSON.
 raw=json.dumps(obj,ensure_ascii=False)
 raw=raw.replace('&','\\u0026').replace('<','\\u003c').replace('>','\\u003e')
 return '<script type="application/ld+json">'+raw+'</script>'

def org_schema(desc):
 return {"@context":"https://schema.org","@type":"GeneralContractor",
  "@id":SITE+"/#organization",
  "name":"Gold Coast Build","url":SITE+"/","description":desc,
  "telephone":"+1-312-600-7111","email":"Office@GoldCoastBld.com",
  "image":SITE+SOCIAL,"logo":SITE+"/assets/logo.png",
  "address":{"@type":"PostalAddress","streetAddress":"875 N Michigan Ave, Suite 3100",
   "addressLocality":"Chicago","addressRegion":"IL","postalCode":"60611","addressCountry":"US"},
  # coordinates for 875 N Michigan Ave -- verify against the Google Business
  # Profile before launch
  "geo":{"@type":"GeoCoordinates","latitude":41.8988,"longitude":-87.6229},
  "areaServed":[{"@type":"City","name":n} for n in
   ("Chicago","Highland Park","Glenview","Norridge","Downers Grove")],
  "knowsAbout":["Custom home construction","Residential renovation",
   "Condominium remodeling","Commercial construction","Office build-outs"]}

def faq_schema():
 return {"@context":"https://schema.org","@type":"FAQPage",
  "mainEntity":[{"@type":"Question","name":q,
   "acceptedAnswer":{"@type":"Answer","text":a}} for q,a in editorial.FAQ_PAIRS]}

def breadcrumb(trail):
 return {"@context":"https://schema.org","@type":"BreadcrumbList",
  "itemListElement":[{"@type":"ListItem","position":i+1,"name":n,"item":SITE+u}
   for i,(n,u) in enumerate(trail)]}

def ldjson(desc,extra=None):
 return _block(org_schema(desc))+''.join(_block(x) for x in (extra or []))
locations=['Streeterville, Chicago','Highland Park, Illinois','Glenview, Illinois','Glenview, Illinois','Norridge, Illinois','Norridge, Illinois','Downers Grove, Illinois']
names=['A new perspective on city living.','Contemporary North Shore living.','Crafted for the way you live.','Modern craftsmanship. Lasting character.','Room to make a life.','A home with presence.','A considered approach to townhome living.']
short=['John Hancock Residence','Highland Park Residence','Glenview Custom Home','Glenview Residence','Norridge Custom Home','Ozark Avenue Residence','Downers Grove Townhome']
descriptions=[
'A complete renovation of a 929-square-foot residence in Chicago’s John Hancock Center. An open plan, custom cabinetry, and updated finishes create a bright, composed home above the city.',
'A 3,534-square-foot new home across three levels. Vaulted ceilings, an open kitchen, and carefully planned living spaces bring a sense of light and ease to this Highland Park residence.',
'A 5,248-square-foot custom residence with five bedrooms and generous spaces for gathering. Custom cabinetry, quartzite surfaces, and a full-height stone fireplace give the home its distinctive character.',
'A Glenview residence with distinctive gabled architecture, contrasting exterior materials, and bright, connected interiors. The kitchen and gathering spaces bring a contemporary sense of openness to the home.',
'A custom-built Norridge residence with a masonry exterior, a welcoming arched entrance, and generous interior gathering spaces. An open kitchen and carefully detailed staircase give the home its individual character.',
'A Norridge residence defined by its covered entrance, layered rooflines, and combination of siding and masonry. The exterior balances a welcoming scale with a distinct architectural presence.',
'A Downers Grove townhome with a strong street presence and open living spaces. Large windows, continuous wood floors, and a kitchen centered on an island give the interior a bright, connected feel.'
]
for i,p in enumerate(projects):p.update(location=locations[i],short=short[i],name=names[i],desc=descriptions[i],category='renovation' if i==0 else 'new-build')
def btn(text,url='/contact/',outline=False):return f'<a class="btn {"outline" if outline else ""}" href="{url}">{text}<span aria-hidden="true" class="arrow">↗</span></a>'
def brand():return '<a class="brand" href="/" aria-label="Gold Coast Build home"><img src="/assets/logo.png" alt="" width="82" height="82" decoding="async"></a>'
def cta():return '<section class="cta"><div class="wrap"><div><div class="eyebrow">Your vision deserves a thoughtful builder</div><h2>Build your next chapter<br>with Gold Coast Build.</h2><p>You have a vision for what comes next. GCB brings residential and commercial construction experience to the conversation. Tell us what you want to create, and let’s explore the possibilities together.</p></div><div class="cta-action">'+btn('Start your GCB project')+'<a href="tel:+13126007111">Or call (312) 600-7111</a></div></div></section>'

def shell(title,body,path='/',desc=None,call=True,schema=None):
 nav=''.join(f'<a href="{u}" '+('aria-current="page"' if path==u else '')+f'>{n}</a>' for n,u in [('Our company','/about/'),('Projects','/projects/'),('Residential','/residential-construction/'),('Commercial','/commercial-construction/')])
 desc=desc or 'Gold Coast Build provides custom home construction, residential renovation, and commercial construction across Chicago and the surrounding suburbs.'
 out=f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{html.escape(title)} | Gold Coast Build</title><meta name="description" content="{html.escape(desc,quote=True)}"><meta name="theme-color" content="#14191d"><link rel="canonical" href="{SITE}{path}"><meta property="og:site_name" content="Gold Coast Build"><meta property="og:locale" content="en_US"><meta property="og:title" content="{html.escape(title,quote=True)} | Gold Coast Build"><meta property="og:description" content="{html.escape(desc,quote=True)}"><meta property="og:type" content="website"><meta property="og:url" content="{SITE}{path}"><meta property="og:image" content="{SITE}{SOCIAL}"><meta property="og:image:alt" content="A Gold Coast Build custom residence in Glenview, Illinois"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{html.escape(title,quote=True)} | Gold Coast Build"><meta name="twitter:description" content="{html.escape(desc,quote=True)}"><meta name="twitter:image" content="{SITE}{SOCIAL}"><link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" type="image/png" href="/assets/logo.png"><link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">{FONTS}<link rel="stylesheet" href="/style.css"><script defer src="/app.js"></script>{ldjson(desc,schema)}</head><body><a class="skip" href="#main">Skip to content</a><header><div class="wrap nav">{brand()}<button type="button" class="menu" aria-controls="navigation" aria-expanded="false">Menu</button><nav id="navigation" aria-label="Main navigation">{nav}{btn('Start a conversation')}</nav></div></header><main id="main">{body}{cta() if call else ''}</main><footer><div class="wrap"><div class="footer-top"><div>{brand()}<p>Residential & commercial construction.<br>Built around your vision. Grounded in Chicago.</p></div><div><h3>Explore</h3><a href="/about/">Our company</a><a href="/projects/">Our work</a><a href="/residential-construction/">Residential construction</a><a href="/commercial-construction/">Commercial construction</a><a href="/blog/">Insights</a></div><div><h3>Let’s talk</h3><a href="tel:+13126007111">(312) 600-7111</a><a href="mailto:Office@GoldCoastBld.com">Office@GoldCoastBld.com</a><p>875 N Michigan Ave, Suite 3100<br>Chicago, IL 60611</p><a href="/contact/">Start your project ↗</a></div></div><div class="footer-bottom"><span>© 2026 Gold Coast Build LLC. All rights reserved.</span><span>Chicago · North Shore · Western Suburbs</span><a class="to-top" href="#top" aria-label="Back to top"><span aria-hidden="true">↑</span></a></div></div></footer></body></html>'''
 SITEMAP.append(path)
 folder=D/path.strip('/');folder.mkdir(parents=True,exist_ok=True);(folder/'index.html').write_text(out,encoding='utf-8',newline='\n')
def card(i,featured=False):return photography.card(projects[i],i,featured)

def head(kicker,title,desc=''):return f'<section class="page-head"><div class="wrap"><div class="eyebrow gold">{kicker}</div><h1>{title}</h1>{"<p>"+desc+"</p>" if desc else ""}</div></section>'
def process():return editorial.process()

home=f'''<section class="hero">{photography.photo(projects[3]['local'][1],'Modern Glenview residence with distinctive gabled architecture',False,'hero')}<div class="wrap content"><div class="eyebrow gold">Chicago & the surrounding suburbs</div><h1>Exceptional spaces.<br><em>Built with purpose.</em></h1><p>Gold Coast Build creates custom homes, refined renovations, and commercial spaces across Chicagoland. Bring us your vision. Let’s build a place you are proud to call yours.</p><div class="actions">{btn('Explore our work','/projects/')}{btn('Start your project','/contact/',True)}</div></div><div class="hero-bottom"><div>RESIDENTIAL & COMMERCIAL<br><span>From first ideas to final details.</span></div><div><strong>Featured / Glenview Residence</strong><br><span>Glenview, Illinois</span></div></div></section>
<section class="wrap intro"><div class="eyebrow">The Gold Coast Build standard</div><div><h2>Your vision deserves<br>Gold Coast Build.</h2><div class="body"><p>From a residence above the Chicago skyline to a custom home on the North Shore, Gold Coast Build brings a considered approach to the places that matter. We handle new construction and remodeling for homeowners and businesses, connecting the larger vision with the details that give a space its character.</p><p style="margin-top:22px">Our work brings together architectural presence, practical living, and carefully finished interiors. Explore what GCB has built—and imagine what we can create with you.</p><a class="text-link" href="/about/">Meet Gold Coast Build <span>↗</span></a></div></div></section>
<section class="section projects"><div class="wrap"><div class="section-head"><div><div class="eyebrow">Selected work / Chicagoland</div><h2>Built to be lived in.<br>Made to stand apart.</h2></div><a class="text-link" href="/projects/">View all projects <span>↗</span></a></div><div class="project-grid">{card(2,True)}{card(1)}{card(0)}</div></div></section>
<section class="section services"><div class="wrap"><div class="section-head"><div><div class="eyebrow gold">Our expertise</div><h2>Your ambition.<br>Our attention to detail.</h2></div><p>One construction partner for the places you live, work, and grow.</p></div><a class="service-row" href="/residential-construction/"><span class="number">01</span><h3>Residential construction</h3><p>Custom homes, condominium renovations, and residential remodeling shaped around the way you want to live.</p><span class="arrow">↗</span></a><a class="service-row" href="/commercial-construction/"><span class="number">02</span><h3>Commercial construction</h3><p>New commercial spaces, build-outs, and renovations that put the needs of your business at the center.</p><span class="arrow">↗</span></a></div></section>{process()}'''
home=home.replace('<section class="section projects">', editorial.principles()+'<section class="section projects">',1)
home=home.replace(process(),editorial.feature()+process()+editorial.partnership()+editorial.local())
shell('Custom Homes & Commercial Construction in Chicago',home,'/','Gold Coast Build builds custom homes, renovations and commercial spaces across Chicago, the North Shore and the western suburbs. See the portfolio and start a conversation.')
shell('Our Projects',head('Our portfolio','The work speaks<br>for itself.','Explore homes and renovations across Chicago, the North Shore, and the western suburbs.')+'<section class="section"><div class="wrap"><div class="filter-bar" aria-label="Filter projects"><button type="button" class="active" data-filter="all" aria-pressed="true">All projects</button><button type="button" data-filter="new-build" aria-pressed="false">New construction</button><button type="button" data-filter="renovation" aria-pressed="false">Renovations</button></div><div class="project-grid">'+''.join(card(i) for i in range(7))+'</div></div></section>','/projects/','Seven completed Gold Coast Build projects across Chicagoland: custom homes in Glenview, Highland Park and Norridge, a John Hancock Center renovation and a Downers Grove townhome.',schema=[breadcrumb([('Home','/'),('Projects','/projects/')])])
for i,p in enumerate(projects):
 body=photography.project(p,i,editorial.project_notes(i))
 shell(p['short'],body,p['path']+'/',p['desc'],schema=[breadcrumb([('Home','/'),('Projects','/projects/'),(p['short'],p['path']+'/')])])
shell('Our Company',head('Gold Coast Build / Chicago','Built on care.<br>Defined by the details.','Gold Coast Build is a Chicago-based residential and commercial construction company, bringing new homes, renovated residences, and business spaces to life across the city and surrounding suburbs.')+f'<section class="section"><div class="wrap split">{photography.photo(projects[1]["local"][2],"Interior of the Highland Park residence")}<div><div class="eyebrow">From the city to the suburbs</div><h2>Local perspective.<br>Personal commitment.</h2><p>Gold Coast Build brings together the ambition of a new construction project and the possibilities within an existing property. Our residential work includes custom homes, condominium renovations, and remodeling; our commercial services support new spaces, build-outs, and property improvements.</p><p>Based on North Michigan Avenue in Chicago, GCB serves clients across the city and surrounding suburbs. Our portfolio moves from the vertical setting of the John Hancock Center to the residential neighborhoods of Highland Park, Glenview, Norridge, and Downers Grove. Each project reflects a different way of living—and a distinct opportunity to build well.</p><a class="text-link" href="/projects/">See our work <span>↗</span></a></div></div></section>'+editorial.about_detail()+editorial.principles()+editorial.partnership()+process()+editorial.local(),'/about/','Gold Coast Build is a Chicago-based residential and commercial construction company on North Michigan Avenue, building across the city, the North Shore and the western suburbs.',schema=[breadcrumb([('Home','/'),('Our company','/about/')])])
for commercial in [False,True]:
 title='Commercial construction' if commercial else 'Residential construction';path='/commercial-construction/' if commercial else '/residential-construction/'
 headline='Spaces that work<br>for your business.' if commercial else 'Your life.<br>Beautifully built.'
 intro='New construction, build-outs, and remodeling for offices, retail, and other commercial properties.' if commercial else 'Custom homes, condominium renovations, and remodeling across Chicago and the surrounding suburbs.'
 image=pages[7]['local'][1] if commercial else projects[2]['local'][2]
 items=['New commercial construction','Office and retail build-outs','Commercial remodeling','Updates to existing spaces'] if commercial else ['New custom homes','Whole-home renovations','Condominium and apartment remodeling','Kitchen, bathroom, and interior updates']
 content=head(title,headline,intro)+f'<section class="section"><div class="wrap split">{photography.photo(image,title+" from Gold Coast Build’s current portfolio")}<div><div class="eyebrow">Built around your priorities</div><h2>{"A foundation for<br>what comes next." if commercial else "Make room for<br>the way you live."}</h2><p>{"Your space should support your operations, your team, and the people you serve. Gold Coast Build works with you to translate business requirements into a practical construction scope." if commercial else "Whether you are starting with an empty lot or reimagining a familiar space, Gold Coast Build brings your ideas into focus with construction tailored to your home."}</p><ul class="list">'+''.join('<li>'+x+'</li>' for x in items)+'</ul>'+btn('Discuss your project')+'</div></div></section>'+process()
 content=content.replace(process(),editorial.service_detail(commercial)+editorial.service_pitch(commercial)+process()+editorial.faq())
 sdesc=('Commercial construction in Chicago: new build, office and retail build-outs, and remodeling of existing commercial property, planned around how your business uses the space.' if commercial else 'Residential construction in Chicago and the suburbs: custom homes, whole-home renovations, condominium remodeling, and kitchen and bathroom updates.')
 shell(title,content,path,sdesc,schema=[faq_schema(),breadcrumb([('Home','/'),(title,path)])])
contact=head('Start a conversation','A great build starts<br>with your vision.','Tell us what you have in mind. Let’s discuss your property, your priorities, and the next steps.')+'''<section class="section"><div class="wrap contact-layout"><div class="contact-details"><div class="eyebrow">Gold Coast Build LLC</div><h2>Let’s talk.</h2><a href="tel:+13126007111">(312) 600-7111</a><a href="mailto:Office@GoldCoastBld.com">Office@GoldCoastBld.com</a><p>875 N Michigan Ave, Suite 3100<br>Chicago, IL 60611</p><a class="text-link" href="https://www.google.com/maps/search/?api=1&query=875+N+Michigan+Ave+Chicago+IL+60611" target="_blank" rel="noopener">View office location ↗</a></div><div class="contact-panel"><div class="eyebrow">Your project / Our next conversation</div><h2>Schedule a free consultation.</h2><p>Share the project location, the type of work, and where you are in the planning process. Plans or inspiration photos are welcome.</p><div class="contact-options"><a class="btn" href="mailto:Office@GoldCoastBld.com?subject=New%20project%20inquiry&body=Hello%20Gold%20Coast%20Build%2C%0A%0AI%20would%20like%20to%20discuss%20a%20project.%0A%0AName%3A%0APhone%3A%0AProject%20location%3A%0AType%20of%20work%3A%0AIdeal%20timing%3A%0AProject%20details%3A%0A">Email your project details <span>↗</span></a><a class="text-link" href="tel:+13126007111">Prefer a conversation? Call us <span>↗</span></a></div><p class="contact-note">The email link opens your email app with a project outline ready to complete and send.</p></div></div></section>'''
shell('Contact',contact+editorial.faq(),'/contact/','Talk to Gold Coast Build about a residential or commercial construction project in Chicago. Call (312) 600-7111 or email Office@GoldCoastBld.com.',call=False,schema=[faq_schema(),breadcrumb([('Home','/'),('Contact','/contact/')])])
shell('Insights',head('Insights','A little perspective.<br>Before you build.','Planning notes and project inspiration from Gold Coast Build.')+'<section class="section"><div class="wrap"><div class="split"><div><div class="eyebrow">Planning your project</div><h2>A better conversation<br>starts with a clear brief.</h2></div><div><p>Before contacting a builder, gather the basics: your project address, the spaces you want to change, any existing plans, and the timing you have in mind.</p><p style="margin-top:20px">Separating essential requirements from preferences helps frame an early discussion about scope. Photos of the existing property and examples of spaces you like are a useful starting point.</p><a class="text-link" href="/contact/">Discuss your plans <span>↗</span></a></div></div></div></section>','/blog/','Planning notes from Gold Coast Build: how to prepare for a construction conversation, what to gather before contacting a builder, and how scope is framed.')
shell('Page Not Found',head('404','Let’s get you<br>back on track.','The page you’re looking for is not here.')+'<section class="section wrap">'+btn('Return home','/')+'</section>','/404/',call=False)
(D/'404.html').write_text((D/'404/index.html').read_text(encoding='utf-8'),encoding='utf-8',newline='\n')

# ---- static source files ---------------------------------------------------
for name in ('style.css','app.js'):
 (D/name).write_text((SRC/name).read_text(encoding='utf-8'),encoding='utf-8',newline='\n')

# ---- logo: ship a 2x-of-rendered copy, not the 1327px original -------------
with Image.open(SRC/'assets'/'logo.png') as _logo:
 _logo.thumbnail((164,164),Image.LANCZOS)
 (D/'assets').mkdir(parents=True,exist_ok=True)
 _logo.save(D/'assets'/'logo.png',optimize=True)

# ---- icons: favicon.ico + apple-touch-icon, padded square, never squashed --
with Image.open(SRC/'assets'/'logo.png') as _l:
 _l=_l.convert('RGBA'); _side=max(_l.size)
 _sq=Image.new('RGBA',(_side,_side),(0,0,0,0))
 _sq.paste(_l,((_side-_l.width)//2,(_side-_l.height)//2))
 _sq.resize((180,180),Image.LANCZOS).save(D/'assets'/'apple-touch-icon.png',optimize=True)
 _sq.resize((48,48),Image.LANCZOS).save(D/'favicon.ico',sizes=[(16,16),(32,32),(48,48)])

# ---- og:image at the 1.91:1 the social scrapers actually crop to -----------
with Image.open(SRC/'assets'/'project-2-2.jpg') as _o:
 _o=_o.convert('RGB'); _tw,_th=1200,630
 _cut=round(_o.width/(_tw/_th))
 _top=max(0,(_o.height-_cut)//2)
 _o.crop((0,_top,_o.width,min(_o.height,_top+_cut))).resize((_tw,_th),Image.LANCZOS)\
  .save(D/'assets'/'og-image.jpg',quality=86,optimize=True,progressive=True)

# ---- security headers (Netlify / Cloudflare Pages read dist/_headers) ------
(D/'_headers').write_text(
 "/*\n"
 "  X-Content-Type-Options: nosniff\n"
 "  Referrer-Policy: strict-origin-when-cross-origin\n"
 "  X-Frame-Options: DENY\n"
 "  Permissions-Policy: geolocation=(), microphone=(), camera=()\n"
 "  Strict-Transport-Security: max-age=31536000; includeSubDomains\n"
 "  Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none';"
 " frame-ancestors 'none'; form-action 'none'; img-src 'self' data:;"
 " style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;"
 " font-src 'self' https://fonts.gstatic.com; script-src 'self';"
 " upgrade-insecure-requests\n",
 encoding='utf-8',newline='\n')

# ---- drop any asset this build did not reference ---------------------------
keep={'logo.png','apple-touch-icon.png','og-image.jpg'}
for _n,_v in photography._built_map.items():
 keep.add(_n); keep.update(u.split('/')[-1] for u,_w in _v)
removed=0
for f in (D/'assets').iterdir():
 if f.name not in keep: f.unlink(); removed+=1

# ---- robots.txt + sitemap.xml ---------------------------------------------
(D/'robots.txt').write_text(
 'User-agent: *\nAllow: /\n\nSitemap: '+SITE+'/sitemap.xml\n',
 encoding='utf-8',newline='\n')
_today=__import__('datetime').date.today().isoformat()
urls=''.join('<url><loc>'+SITE+u+'</loc><lastmod>'+_today+'</lastmod>'
 '<changefreq>monthly</changefreq>'
 '<priority>'+('1.0' if u=='/' else '0.7')+'</priority></url>'
 for u in SITEMAP if u!='/404/')
(D/'sitemap.xml').write_text(
 '<?xml version="1.0" encoding="UTF-8"?>'
 '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls+'</urlset>',
 encoding='utf-8',newline='\n')

_imgs=sum(1 for _ in (D/'assets').iterdir())
_mb=sum(f.stat().st_size for f in (D/'assets').iterdir())/1048576
print('Built %d HTML pages | %d image files (%.1f MB) | pruned %d unused'
 % (len(list(D.rglob('*.html'))),_imgs,_mb,removed))
