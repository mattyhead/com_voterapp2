<?php

// No direct access
defined('_JEXEC') or die('Restricted access');

/**
 * Items Controller for Voterapp2 Component.
 *
 * @package    Philadelphia.Votes
 * @subpackage Components
 *
 * @license    GNU/GPL
 */
class Voterapp2ControllerItems extends Voterapp2Controller
{
    /**
     * Display the Items View.
     *
     * @return void
     */
    public function display()
    {
        JRequest::setVar('view', 'items');

        parent::display();
    }

    /**
     * Redirect Edit task to Item Controller.
     *
     * @return void
     */
    public function edit()
    {
        $mainframe = JFactory::getApplication();
        $cid       = JRequest::getVar('cid');
        $mainframe->redirect('index.php?option=com_voterapp2&controller=item&task=edit&cid=' . $cid[0]);
    }

    public function publish()
    {
        JRequest::checkToken() or jexit('Invalid Token');

        $model = $this->getModel('Items');
        $model->publish();
        $this->display();
    }

    public function unpublish()
    {
        JRequest::checkToken() or jexit('Invalid Token');

        $model = $this->getModel('Items');
        $model->unpublish();
        $this->display();
    }
}
