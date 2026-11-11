require "minitest/autorun"
require "jekyll"
require "yaml"

class CardUpdateIndicatorTest < Minitest::Test
  def test_indicator_is_limited_to_known_updaters_and_localized
    root = File.expand_path("..", __dir__)
    template = Liquid::Template.parse(File.read(File.join(root, "docs/_includes/list-container.html")))
    cards = YAML.load_file(File.join(root, "docs/_data/cards.yml"))
    plugins = [
      { "name" => "GitHub", "update" => "github" },
      { "name" => "Repository", "update" => "repository" },
      { "name" => "Unknown", "update" => "unknown" },
      { "name" => "Unset" }
    ]

    %w[en de].each do |language|
      html = template.render!(
        "page" => { "lang" => language },
        "site" => { "data" => { "cards" => cards, "plugins" => plugins, "platforms" => {} } }
      )
      label = cards["automatic_update"][language]
      assert_equal 2, html.scan('class="automatic-update-indicator"').size
      assert_equal 2, html.scan("aria-label=\"#{label}\" title=\"#{label}\"").size
      assert_match(/<span data-name="name">GitHub<\/span> <span class="automatic-update-indicator"/, html)
      assert_match(/<span data-name="name">Repository<\/span> <span class="automatic-update-indicator"/, html)
      assert_includes html, '<span data-name="name">Unknown</span></h2>'
      assert_includes html, '<span data-name="name">Unset</span></h2>'
    end
  end
end
